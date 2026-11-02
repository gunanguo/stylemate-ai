import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { COLOR_HEX } from "@/lib/closet/catalog";
import { shopLinks } from "@/lib/closet/shop";
import { dominantColor } from "@/lib/closet/palette";
import { recognizeGarment } from "@/lib/closet/recognize";
import { useCloset } from "@/lib/closet/store";
import {
  CATEGORIES,
  COLOR_OPTIONS,
  STYLE_TAGS,
  type Garment,
  type GarmentCategory,
  type Slot,
} from "@/lib/closet/types";
import { cn } from "@/lib/cn";

const SLOTS: Record<GarmentCategory, Slot> = {
  上衣: "top",
  裤子: "bottom",
  裙子: "bottom",
  外套: "outer",
  鞋子: "shoes",
  包包: "bag",
  配饰: "extra",
};

export function garmentSlot(category: GarmentCategory, cut: string): Slot {
  if (category === "裙子" && /连衣|吊带裙|礼服/.test(cut)) return "onepiece";
  return SLOTS[category];
}

export function PiecePhoto({
  garment,
  className,
}: {
  garment: Pick<Garment, "name" | "image" | "hex">;
  className?: string;
}) {
  const [src, setSrc] = useState(garment.image);
  useEffect(() => {
    setSrc(garment.image);
  }, [garment.image]);
  if (!src) {
    return (
      <div
        className={cn("flex h-full w-full items-center justify-center text-sm font-semibold", className)}
        style={{ backgroundColor: garment.hex, color: "#2c2825" }}
      >
        {garment.name.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={garment.name}
      className={cn("h-full w-full object-cover", className)}
      onError={() => {
        if (src.startsWith("/wardrobe/") && src.endsWith(".jpg")) {
          setSrc(src.replace(/\.jpg$/, ".svg"));
          return;
        }
        setSrc("");
      }}
    />
  );
}

export function RemotePhoto({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

export function EmptyClosetCard({ onAdd }: { onAdd: () => void }) {
  const reset = useCloset((state) => state.reset);
  const steps = [
    ["01", "拍照添加"],
    ["02", "自动识别"],
    ["03", "获取搭配"],
  ] as const;
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-medium">你的衣橱正等待填满</h2>
      <ol className="mt-4 border-t border-border">
        {steps.map(([step, label]) => (
          <li key={step} className="flex items-center gap-4 border-b border-border py-3 text-sm">
            <span className="eyebrow w-8">{step}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 min-h-12 w-full bg-ink text-sm text-ink-foreground"
      >
        拍照添加第一件
      </button>
      <button
        type="button"
        onClick={() => {
          reset();
          toast("已打开示例衣橱");
        }}
        className="mt-4 text-sm text-muted-foreground"
      >
        先用示例衣橱看看
      </button>
    </section>
  );
}

const STUDIO_LOOK = ["blazer", "knit", "loafers", "trousers"].join("\0");

export function isStudioLook(ids: string[]) {
  return [...ids].sort().join("\0") === STUDIO_LOOK;
}

export function LookPhoto({
  ids,
  pieces,
  alt,
  position = "object-cover",
}: {
  ids: string[];
  pieces: Garment[];
  alt: string;
  position?: string;
}) {
  const photo = cn("h-full w-full object-cover", position);
  if (isStudioLook(ids)) {
    return (
      <RemotePhoto
        src="/hero/outfit-today.jpg"
        alt={alt}
        className={photo}
        fallback={<LookCollage pieces={pieces} className="h-full w-full" position={position} />}
      />
    );
  }
  return <LookCollage pieces={pieces} className="h-full w-full" position={position} />;
}

function CollageCell({ piece, position }: { piece: Garment; position?: string }) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <PiecePhoto garment={piece} className={position} />
    </div>
  );
}

/** Fill a 3:4 frame from the pieces actually in the look. */
export function LookCollage({
  pieces,
  className,
  position,
}: {
  pieces: Garment[];
  className?: string;
  position?: string;
}) {
  const shown = pieces.slice(0, 4);
  const frame = cn("grid h-full w-full gap-px overflow-hidden", className);
  if (shown.length === 0) return <div className={cn("h-full w-full", className)} />;
  if (shown.length === 1) {
    return (
      <div className={cn("h-full w-full overflow-hidden", className)}>
        <PiecePhoto garment={shown[0]} className={position} />
      </div>
    );
  }
  if (shown.length === 2) {
    return (
      <div className={cn(frame, "grid-cols-2")}>
        {shown.map((piece) => (
          <CollageCell key={piece.id} piece={piece} position={position} />
        ))}
      </div>
    );
  }
  if (shown.length === 3) {
    return (
      <div className={cn(frame, "grid-cols-2 grid-rows-2")}>
        <div className="row-span-2 h-full min-h-0 overflow-hidden">
          <PiecePhoto garment={shown[0]} className={position} />
        </div>
        {shown.slice(1).map((piece) => (
          <CollageCell key={piece.id} piece={piece} position={position} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn(frame, "grid-cols-2 grid-rows-2")}>
      {shown.map((piece) => (
        <CollageCell key={piece.id} piece={piece} position={position} />
      ))}
    </div>
  );
}

export function ShopLinks({
  item,
  className,
}: {
  item: { name: string; brand: string };
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 gap-2", className)}>
      {shopLinks(item).map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
        >
          {link.label}
        </a>
      ))}
    </span>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 text-sm text-muted-foreground",
        active && "text-foreground underline decoration-foreground underline-offset-8",
      )}
    >
      {children}
    </button>
  );
}

export async function compressGarmentPhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("无法读取这张照片，请换一张试试"));
      el.src = url;
    });
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法读取这张照片，请换一张试试");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.72;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 120_000 && quality > 0.42) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Draft = {
  id?: string;
  name: string;
  brand: string;
  category: GarmentCategory;
  color: string;
  customColor: string;
  styles: string[];
  styleDraft: string;
  cut: string;
  price: string;
  owned: boolean;
  image: string;
};

function emptyDraft(): Draft {
  return {
    name: "",
    brand: "",
    category: "上衣",
    color: "奶油白",
    customColor: "",
    styles: [],
    styleDraft: "",
    cut: "",
    price: "",
    owned: true,
    image: "",
  };
}

function fromGarment(garment: Garment): Draft {
  const known = (COLOR_OPTIONS as readonly string[]).includes(garment.color);
  return {
    id: garment.id,
    name: garment.name,
    brand: garment.brand,
    category: garment.category,
    color: known ? garment.color : "",
    customColor: known ? "" : garment.color,
    styles: garment.styles,
    styleDraft: "",
    cut: garment.cut,
    price: garment.price ? String(garment.price) : "",
    owned: garment.owned,
    image: garment.image,
  };
}

export function GarmentSheet({
  garment,
  onClose,
}: {
  garment?: Garment;
  onClose: () => void;
}) {
  const addGarment = useCloset((state) => state.addGarment);
  const updateGarment = useCloset((state) => state.updateGarment);
  const recognize = useServerFn(recognizeGarment);
  const [draft, setDraft] = useState<Draft>(() => (garment ? fromGarment(garment) : emptyDraft()));
  const [reading, setReading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const editing = Boolean(garment);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const image = await compressGarmentPhoto(file);
      setDraft((current) => ({ ...current, image }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "无法读取这张照片，请换一张试试");
    } finally {
      setReading(false);
    }
  }

  async function recognizePhoto() {
    if (!draft.image) {
      toast("请添加衣物照片");
      return;
    }
    if (!draft.image.startsWith("data:")) {
      toast("示例单品已有资料，可直接修改");
      return;
    }
    setRecognizing(true);
    try {
      const result = await recognize({ data: { image: draft.image } });
      if (!result.ok) {
        const color = await dominantColor(draft.image);
        if (color) {
          setDraft((current) => ({ ...current, color, customColor: "" }));
          toast("没能识别款式，已按照片填了颜色");
        } else toast(result.error);
        return;
      }
      const known = (COLOR_OPTIONS as readonly string[]).includes(result.garment.color);
      setDraft((current) => ({
        ...current,
        name: result.garment.name,
        category: result.garment.category,
        color: known ? result.garment.color : "",
        customColor: known ? "" : result.garment.color,
        cut: result.garment.cut,
        styles: result.garment.styles,
      }));
      toast("识别完成，所有信息都可以修改");
    } catch {
      const color = draft.image.startsWith("data:") ? await dominantColor(draft.image) : null;
      if (color) {
        setDraft((current) => ({ ...current, color, customColor: "" }));
        toast("网络不稳定，已按照片填了颜色");
      } else toast("网络不稳定，请稍后再试，或手动填写");
    } finally {
      setRecognizing(false);
    }
  }

  function save() {
    const name = draft.name.trim();
    if (!name) {
      toast("请填写衣物名称");
      return;
    }
    const color = (draft.customColor.trim() || draft.color || "奶油白").slice(0, 12);
    const next: Garment = {
      id: draft.id ?? `g-${Date.now().toString(36)}`,
      name,
      brand: draft.brand.trim(),
      category: draft.category,
      slot: garmentSlot(draft.category, draft.cut),
      color,
      hex: COLOR_HEX[color] ?? "#d9d0c5",
      styles: draft.styles,
      cut: draft.cut.trim(),
      price: Math.max(0, Math.round(Number(draft.price) || 0)),
      owned: draft.owned,
      image: draft.image,
      warmth: draft.category === "外套" ? 2 : 1,
      formality: draft.styles.includes("休闲") || draft.styles.includes("街头") ? 1 : 2,
      addedAt: garment?.addedAt ?? Date.now(),
    };
    const result = editing ? updateGarment(next) : addGarment(next);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    if (result.warning) toast(result.warning);
    else if (editing) toast("修改已保存", { id: "closet-edit" });
    else toast(`「${next.name}」已放入衣橱`);
    onClose();
  }

  function addStyle() {
    const style = draft.styleDraft.trim();
    if (!style || draft.styles.includes(style)) {
      setDraft((current) => ({ ...current, styleDraft: "" }));
      return;
    }
    setDraft((current) => ({ ...current, styles: [...current.styles, style].slice(0, 4), styleDraft: "" }));
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md flex-col bg-background">
      <header className="flex items-center justify-between px-5 pt-10 pb-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{editing ? "编辑资料" : "拍照或上传"}</p>
          <h2 className="text-2xl font-semibold">{editing ? "编辑衣物" : "添加衣物"}</h2>
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="relative aspect-look bg-muted">
            {draft.image ? (
              <img src={draft.image} alt="已选衣物照片" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <ImagePlus className="h-6 w-6 text-primary" />
                <p className="mt-3 text-sm font-medium">添加衣物照片</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  平铺或挂起，在光线充足处拍摄效果最佳
                </p>
              </div>
            )}
            {reading ? (
              <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium">正在处理照片…</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <label className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-medium">
              <ImagePlus className="h-4 w-4" />
              从相册选择
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
            <label className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-medium">
              <Camera className="h-4 w-4" />
              拍照上传
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void recognizePhoto()}
          disabled={recognizing}
          className="mt-4 text-sm text-muted-foreground disabled:opacity-60"
        >
          {recognizing ? "正在识别衣物…" : draft.image ? "重新识别" : "识别这张照片"}
        </button>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {recognizing
            ? "正在分析款式与风格…"
            : "AI 会识别类别、颜色、款式和风格，也可以跳过手动填写"}
        </p>

        <label className="mt-6 block text-xs font-medium text-muted-foreground">
          名称
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如：奶油白羊毛西装"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none"
          />
        </label>
        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          品牌
          <input
            value={draft.brand}
            onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}
            placeholder="例如：COS"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none"
          />
        </label>

        <p className="mt-4 text-xs font-medium text-muted-foreground">类别</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.filter((item) => item !== "全部").map((item) => (
            <Chip
              key={item}
              active={draft.category === item}
              onClick={() => setDraft((current) => ({ ...current, category: item }))}
            >
              {item}
            </Chip>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-muted-foreground">颜色</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((item) => (
            <Chip
              key={item}
              active={draft.color === item && !draft.customColor}
              onClick={() => setDraft((current) => ({ ...current, color: item, customColor: "" }))}
            >
              {item}
            </Chip>
          ))}
        </div>
        <input
          value={draft.customColor}
          onChange={(event) => setDraft((current) => ({ ...current, customColor: event.target.value }))}
          placeholder="或自己输入，例如：橄榄绿"
          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          款式
          <input
            value={draft.cut}
            onChange={(event) => setDraft((current) => ({ ...current, cut: event.target.value }))}
            placeholder="例如：双排扣西装、高腰阔腿裤"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
          />
        </label>

        <p className="mt-4 text-xs font-medium text-muted-foreground">风格</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STYLE_TAGS.map((item) => (
            <Chip
              key={item}
              active={draft.styles.includes(item)}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  styles: current.styles.includes(item)
                    ? current.styles.filter((style) => style !== item)
                    : [...current.styles, item].slice(0, 4),
                }))
              }
            >
              {item}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={draft.styleDraft}
            onChange={(event) => setDraft((current) => ({ ...current, styleDraft: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addStyle();
              }
            }}
            placeholder="自定义风格，例如：学院风"
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={addStyle}
            className="flex min-h-11 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            添加风格
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          价格（元）
          <input
            inputMode="numeric"
            value={draft.price}
            onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
            placeholder="399"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setDraft((current) => ({ ...current, owned: !current.owned }))}
          className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-3 text-sm"
        >
          <span>{draft.owned ? "已经在我的衣橱" : "还想买，先记为新品"}</span>
          <span className={cn("text-xs", draft.owned ? "text-muted-foreground" : "text-accent")}>
            {draft.owned ? "已有" : "想买"}
          </span>
        </button>

        <button
          type="button"
          onClick={save}
          className="mt-8 min-h-12 w-full bg-ink text-sm text-ink-foreground"
        >
          {editing ? "保存修改" : "放入衣橱"}
        </button>
      </div>
    </div>
  );
}
