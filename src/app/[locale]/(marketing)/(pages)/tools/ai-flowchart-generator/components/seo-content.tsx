import Container from '@/components/layout/container';
import seoData from '../data/seo-content.json';

export function SEOContent() {
  const { seo } = seoData;

  return (
    <Container className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* What is it Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.whatIsIt.title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground">{seo.whatIsIt.content}</p>
        </section>

        {/* Why choose Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.whyChoose.title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">{seo.whyChoose.content}</p>
          <div className="space-y-8">
            {seo.whyChoose.points.map((p, i) => (
              <div key={i}>
                <h3 className="text-2xl font-semibold mb-4">{p.title}</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it Works Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.howItWorks.title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">{seo.howItWorks.content}</p>
          <div className="space-y-8">
            {seo.howItWorks.steps.map((step, index) => (
              <div key={index}>
                <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Use Cases Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.useCases.title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">{seo.useCases.content}</p>
          <div className="space-y-8">
            {seo.useCases.cases.map((useCase, index) => (
              <div key={index}>
                <h3 className="text-2xl font-semibold mb-4">{useCase.title}</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.features.title}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">{seo.features.content}</p>
          <div className="space-y-8">
            {seo.features.features.map((feature, index) => (
              <div key={index}>
                <h3 className="text-2xl font-semibold mb-4">{feature.title}</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-3xl font-bold mb-8">{seo.faq.title}</h2>
          <div className="space-y-8">
            {seo.faq.questions.map((faq, index) => (
              <div key={index}>
                <h3 className="text-2xl font-semibold mb-4">{faq.question}</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}

