import "./logo-morph.css";

/**
 * The five strokes of the MetFix asterisk, cycling through a fork and knife
 * (the pill becomes the blade), a barbell (the pill is the handle), and a book
 * (the pill is the spine). Poses live in logo-morph.css.
 */
export default function LogoMorph() {
  return (
    <svg
      className="logo-morph"
      viewBox="0 0 100 100"
      role="img"
      aria-label="MetFix logo morphing into a fork and knife, a barbell, and a book"
    >
      <rect className="logo-morph__line logo-morph__a" x="19.708" y="46.208" width="60.583" height="7.583" />
      <rect className="logo-morph__line logo-morph__b" x="19.708" y="46.208" width="60.583" height="7.583" />
      <rect className="logo-morph__line logo-morph__c" x="19.708" y="46.208" width="60.583" height="7.583" />
      <rect className="logo-morph__line logo-morph__d" x="46.208" y="50" width="7.583" height="30.292" />
      <rect className="logo-morph__pill" x="46.208" y="23.5" width="7.583" height="15.167" rx="3.792" ry="3.792" />
    </svg>
  );
}
