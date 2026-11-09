import * as m from "../paraglide/messages.js";

export const FaqInteractivePreview = () => {
  const questions = [
    { question: m.web_ui_faq_start_q(), answer: m.web_ui_faq_start_a() },
    { question: m.web_ui_faq_platform_q(), answer: m.web_ui_faq_platform_a() },
    { question: m.web_ui_faq_account_q(), answer: m.web_ui_faq_account_a() },
    { question: m.web_ui_faq_permissions_q(), answer: m.web_ui_faq_permissions_a() },
    { question: m.web_ui_faq_agent_q(), answer: m.web_ui_faq_agent_a() },
  ];
  return (
    <section id="faq" className="site-section site-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">{m.web_ui_faq_title()}</h2>
      <div>
        {questions.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
};
