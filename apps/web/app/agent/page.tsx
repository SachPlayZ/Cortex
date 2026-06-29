import { StatusPill } from "../../components/status-pill";
import { demoInvoices } from "../../lib/demo-data";

export default function AgentPage() {
  return (
    <>
      <div className="sectionTitle"><h2>Agent Dashboard</h2></div>
      <section className="trace">
        {demoInvoices.flatMap((invoice) =>
          invoice.trace.map((item) => (
            <div className="traceItem" key={`${invoice.id}-${item.actor}-${item.event}`}>
              <strong>{invoice.id} - {item.actor}</strong>
              <span>{item.event}</span>
              <StatusPill status={item.status} />
            </div>
          ))
        )}
      </section>
    </>
  );
}
