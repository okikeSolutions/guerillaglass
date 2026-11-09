import * as m from "../paraglide/messages.js";

export const FeatureBento = () => {
  const steps = [
    { title: m.web_ui_record_title(), body: m.web_ui_record_body() },
    { title: m.web_ui_edit_title(), body: m.web_ui_edit_body() },
    { title: m.web_ui_deliver_title(), body: m.web_ui_deliver_body() },
  ];
  return (
    <section id="product" className="site-section" aria-labelledby="workflow-title">
      <h2 id="workflow-title">{m.web_ui_workflow_title()}</h2>
      <ol className="site-workflow">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="site-step-number" aria-hidden="true">
              0{index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};
