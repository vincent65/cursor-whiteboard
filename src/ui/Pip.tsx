// Pip, Blueprint's mascot: a little sheet of blueprint paper with a folded
// corner, dot eyes, and pink cheeks. It blinks now and then, and hops while
// Claude works.
export function Pip({
  size = 20,
  hopping = false,
}: {
  size?: number;
  hopping?: boolean;
}) {
  return (
    <svg
      className={hopping ? "pip pip-hopping" : "pip"}
      viewBox="12 8 40 50"
      width={size}
      height={(size * 50) / 40}
      // Decorative: the name beside it, or the panel's status, says the same.
      aria-hidden="true"
    >
      <g className="pip-figure">
        <path
          className="pip-sheet"
          d="M21 10H38L50 22V49A7 7 0 0 1 43 56H21A7 7 0 0 1 14 49V17A7 7 0 0 1 21 10Z"
        />
        <path className="pip-grid" d="M14 27H50M14 45H50M26 10V56M38 22V56" />
        <path className="pip-fold" d="M38 10V18A4 4 0 0 0 42 22H50Z" />
        <g className="pip-eyes">
          <circle className="pip-eye" cx="25.5" cy="35" r="2.6" />
          <circle className="pip-eye" cx="38.5" cy="35" r="2.6" />
        </g>
        <ellipse className="pip-cheek" cx="20.5" cy="40.5" rx="2.6" ry="1.6" />
        <ellipse className="pip-cheek" cx="43.5" cy="40.5" rx="2.6" ry="1.6" />
        <path className="pip-smile" d="M29.5 40Q32 42.5 34.5 40" />
      </g>
    </svg>
  );
}
