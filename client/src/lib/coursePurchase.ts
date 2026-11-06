import { useEffect, useState } from "react";
import { openWhopCheckout, purchaseCourseCheckout } from "@/lib/account";
import { loadMe, peekMe } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useCoursePurchase(courseId: number | string | undefined) {
  const [signedIn, setSignedIn] = useState<boolean | null>(() => {
    const me = peekMe();
    if (!me) return null;
    return me.status === "signed_in";
  });
  const [email, setEmail] = useState("");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadMe().then((me) => {
      if (live) setSignedIn(me.status === "signed_in");
    });
    return () => {
      live = false;
    };
  }, []);

  const buy = async () => {
    if (courseId == null || courseId === "" || buying || signedIn == null) return;
    setError(null);
    let guestEmail: string | undefined;
    if (!signedIn) {
      const value = email.trim();
      if (!EMAIL_RE.test(value) || value.length > 254) {
        setError("Enter the email for this purchase.");
        return;
      }
      guestEmail = value;
    }
    setBuying(true);
    try {
      const res = await purchaseCourseCheckout(courseId, {
        return_path: "/checkout/complete",
        ...(guestEmail ? { email: guestEmail } : {}),
      });
      if (!openWhopCheckout(res.checkout_url)) {
        setError("Checkout unavailable. Try again.");
      }
    } catch {
      setError("Checkout unavailable. Try again.");
    } finally {
      setBuying(false);
    }
  };

  return { signedIn, email, setEmail, buying, error, buy };
}
