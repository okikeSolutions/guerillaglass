import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@guerillaglass/ui/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@guerillaglass/ui/ui/card";
import type { LandingContent } from "../../content/landing";

export function FaqSection({ faq }: { faq: LandingContent["faq"] }) {
  return (
    <Card aria-label="FAQ" className="status-card">
      <CardHeader>
        <p className="eyebrow">FAQ</p>
        <CardTitle>{faq.title}</CardTitle>
        <CardDescription>
          Core questions for creator teams evaluating Guerilla Glass.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion>
          {faq.items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
