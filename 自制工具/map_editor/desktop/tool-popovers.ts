type Entry = {
  details: HTMLDetailsElement | null;
  body: HTMLElement;
  trigger: HTMLElement;
  side: "right" | "below";
  point?: [number, number];
};
/** One top-layer sibling menu; dismissing a viewport popup consumes that click. */
export class ToolPopovers {
  private active: Entry | null = null;
  private swallow = false;
  constructor() {
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && this.active) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const trigger = this.active.trigger;
          this.close();
          trigger.focus({ preventScroll: true });
        }
      },
      true,
    );
    window.addEventListener(
      "pointerdown",
      (e) => {
        this.swallow = false;
        const a = this.active;
        if (
          !a ||
          !(e.target instanceof Node) ||
          a.body.contains(e.target) ||
          a.trigger.contains(e.target) ||
          a.details?.querySelector("summary")?.contains(e.target)
        )
          return;
        this.close();
        if (
          e.target instanceof Element &&
          e.target.closest("#editview,#preview,canvas")
        ) {
          this.swallow = true;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    window.addEventListener(
      "click",
      (e) => {
        if (this.swallow) {
          this.swallow = false;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    window.addEventListener("resize", () => this.close());
    window.addEventListener(
      "scroll",
      (e) => {
        if (
          this.active &&
          e.target instanceof Node &&
          !this.active.body.contains(e.target)
        )
          this.close();
      },
      true,
    );
  }
  register(
    details: HTMLDetailsElement,
    body: HTMLElement,
    trigger: HTMLElement,
    side: "right" | "below" = "right",
  ) {
    body.classList.add("tool-popover-body");
    body.setAttribute("popover", "manual");
    const entry: Entry = { details, body, trigger, side };
    details.addEventListener("toggle", () => {
      if (details.open) {
        this.show(entry);
      } else if (this.active === entry) this.close();
    });
    body.addEventListener("toggle", () => {
      if (!body.matches(":popover-open") && this.active === entry) {
        this.active = null;
        details.open = false;
      }
    });
  }
  private show(entry: Entry) {
    if (this.active === entry) return;
    this.close();
    this.active = entry;
    entry.body.showPopover();
    const r = entry.trigger.getBoundingClientRect();
    let x = entry.point?.[0] ?? (entry.side === "right" ? r.right + 6 : r.left),
      y = entry.point?.[1] ?? (entry.side === "right" ? r.top : r.bottom + 6);
    const width = entry.body.getBoundingClientRect().width;
    if (x + width > innerWidth - 8)
      x =
        entry.side === "right"
          ? Math.max(8, r.left - width - 6)
          : innerWidth - width - 8;
    const height = entry.body.getBoundingClientRect().height;
    y = Math.min(y, Math.max(8, innerHeight - height - 8));
    entry.body.style.left = Math.max(8, x) + "px";
    entry.body.style.top = Math.max(8, y) + "px";
    entry.body.style.maxHeight =
      Math.max(120, innerHeight - Math.max(8, y) - 8) + "px";
  }
  close() {
    const a = this.active;
    this.active = null;
    if (!a) return;
    if (a.details) a.details.open = false;
    if (a.body.matches(":popover-open")) a.body.hidePopover();
  }
  openContext(body: HTMLElement, x: number, y: number, trigger: HTMLElement) {
    body.classList.add("tool-popover-body");
    body.setAttribute("popover", "manual");
    this.show({ details: null, body, trigger, side: "below", point: [x, y] });
  }
}
