import { ChevronUp, Facebook, Link2, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dailyFixPath, yymmddFromIso, type Pillar } from "./model";

const SHARE_NOUN: Record<Pillar, string> = {
  belly: "recipe",
  body: "workout",
  brain: "reading",
};

/** Absolute, date-pinned link so a shared "today" keeps pointing at this day. */
export function dailyFixShareUrl(dateIso: string, pillar: Pillar, origin = window.location.origin): string {
  return `${origin}${dailyFixPath(yymmddFromIso(dateIso), pillar)}`;
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-6.3L6.6 22H3.5l7.3-8.3L1 2h6.3l4.3 5.7L18.9 2Zm-1.1 18.2h1.7L6.3 3.7H4.5l13.3 16.5Z" />
    </svg>
  );
}

export function ShareMenu({ dateIso, pillar, title }: { dateIso: string; pillar: Pillar; title: string }) {
  const noun = SHARE_NOUN[pillar];
  const url = dailyFixShareUrl(dateIso, pillar);
  const text = `${title} — The Daily Fix`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy the link");
    }
  };

  const openWindow = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="df-share">
        Share {noun}
        <ChevronUp className="df-share-icon" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="df-share-menu">
        <DropdownMenuItem onSelect={copyLink}>
          <Link2 aria-hidden="true" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`;
          }}
        >
          <Mail aria-hidden="true" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            openWindow(
              `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          <XLogo />
          Post on X
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
          }
        >
          <Facebook aria-hidden="true" />
          Facebook
        </DropdownMenuItem>
        {canNativeShare ? (
          <DropdownMenuItem
            onSelect={() => {
              void navigator.share({ title: text, url }).catch(() => {});
            }}
          >
            <Share2 aria-hidden="true" />
            More options
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
