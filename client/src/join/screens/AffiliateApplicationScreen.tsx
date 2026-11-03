import { useEffect, useRef } from "react";
import { Kicker, Question } from "../ui";

const FILLOUT_SCRIPT_SRC = "https://server.fillout.com/embed/v1/";
const FILLOUT_SCRIPT_ATTR = "data-mfx-fillout-embed";
const FILLOUT_FORM_ID = "xxsjDS5H96us";
const FILLOUT_DOMAIN = "forms.metfix.org";

function ensureFilloutScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[${FILLOUT_SCRIPT_ATTR}]`)) return;
  const script = document.createElement("script");
  script.src = FILLOUT_SCRIPT_SRC;
  script.async = true;
  script.setAttribute(FILLOUT_SCRIPT_ATTR, "1");
  document.body.appendChild(script);
}

export function AffiliateApplicationScreen() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureFilloutScript();
  }, []);

  return (
    <div>
      <Kicker>Affiliate application.</Kicker>
      <Question>Tell us about your location.</Question>
      <div
        ref={hostRef}
        className="mt-8 w-full"
        style={{ width: "100%", minHeight: 500 }}
        data-fillout-id={FILLOUT_FORM_ID}
        data-fillout-embed-type="standard"
        data-fillout-inherit-parameters=""
        data-fillout-dynamic-resize=""
        data-fillout-domain={FILLOUT_DOMAIN}
        data-testid="affiliate-fillout-embed"
      />
    </div>
  );
}
