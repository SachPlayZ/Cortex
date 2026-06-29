const links = [
  ["/", "Demo"],
  ["/seller", "Seller"],
  ["/investor", "Investor"],
  ["/buyer/pay/crd-inr-001", "Buyer Pay"],
  ["/agent", "Agent"],
  ["/admin", "Admin"]
];

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="/">
        <img src="/cortex-logo.png" alt="" className="brandLogo" />
        <span>Cortex</span>
      </a>
      <div className="navLinks">
        {links.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </div>
    </nav>
  );
}
