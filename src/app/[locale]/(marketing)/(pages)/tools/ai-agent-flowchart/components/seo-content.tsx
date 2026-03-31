import Container from '@/components/layout/container';
import { HeaderSection } from '@/components/layout/header-section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import seoData from '../data/seo-content.json';

export function SEOContent() {
  const { seo } = seoData;

  return (
    <Container className="py-20 px-4">
      <div className="mx-auto max-w-6xl space-y-24">
        {/* What is it Section */}
        <section className="px-4">
          <HeaderSection
            id="what-is"
            title={seo.whatIsIt.title}
            titleAs="h2"
            description={seo.whatIsIt.content}
            descriptionAs="p"
            className="mb-8"
          />
        </section>

        {/* How it Works Section */}
        <section className="px-4">
          <HeaderSection
            id="how-it-works"
            title={seo.howItWorks.title}
            titleAs="h2"
            description={seo.howItWorks.content}
            descriptionAs="p"
            className="mb-8"
          />

          <div className="grid gap-6 md:grid-cols-2">
            {seo.howItWorks.steps.map((step, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="px-4">
          <HeaderSection
            id="use-cases"
            title={seo.useCases.title}
            titleAs="h2"
            description={seo.useCases.content}
            descriptionAs="p"
            className="mb-6"
          />
          <div className="grid gap-4">
            {seo.useCases.cases.map((useCase, index) => (
              <Card key={index} className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-xl">{useCase.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {useCase.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4">
          <HeaderSection
            id="features"
            title={seo.features.title}
            titleAs="h2"
            description={seo.features.content}
            descriptionAs="p"
            className="mb-8"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {seo.features.features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4">
          <HeaderSection
            id="faq"
            title={seo.faq.title}
            titleAs="h2"
            className="mb-6"
          />
          <Accordion
            type="single"
            collapsible
            className="w-full rounded-2xl border px-6 py-2"
          >
            {seo.faq.questions.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-dashed"
              >
                <AccordionTrigger className="text-left text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </Container>
  );
}
