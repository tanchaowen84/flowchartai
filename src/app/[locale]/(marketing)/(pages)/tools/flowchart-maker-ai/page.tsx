import Container from '@/components/layout/container';
import { HeaderSection } from '@/components/layout/header-section';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { LocaleLink } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Zap, Clock, Sparkles, CheckCircle, Users, Download, Share2 } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

/**
 * Generate metadata for flowchart maker AI tool page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;

  return constructMetadata({
    title: 'AI Flowchart Maker - Create Professional Flowcharts Instantly',
    description: 'Create professional flowcharts instantly with AI. Just describe your process and watch it come to life. No design skills required.',
    canonicalUrl: getUrlWithLocale('/tools/flowchart-maker-ai', locale),
    noIndex: true,
  });
}

// Features data
const features = [
  {
    icon: Zap,
    title: 'Instant Generation',
    description: 'Create flowcharts in seconds by simply describing your process in natural language.',
  },
  {
    icon: Clock,
    title: 'Save Time',
    description: 'Skip the manual drawing process and focus on your ideas instead of design details.',
  },
  {
    icon: Sparkles,
    title: 'Professional Quality',
    description: 'Generate clean, professional-looking flowcharts that are ready for presentations.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share and collaborate on flowcharts with your team members in real-time.',
  },
  {
    icon: Download,
    title: 'Multiple Formats',
    description: 'Export your flowcharts in various formats including PNG, SVG, and PDF.',
  },
  {
    icon: Share2,
    title: 'Easy Sharing',
    description: 'Share your flowcharts with a simple link or embed them in your documents.',
  },
];

// Use cases data
const useCases = [
  'Business Process Mapping',
  'Software Development Workflows',
  'Decision Trees',
  'System Architecture Diagrams',
  'Project Management Flows',
  'User Journey Mapping',
  'Organizational Charts',
  'Data Flow Diagrams',
];

export default async function FlowchartMakerAIPage() {
  return (
    <Container className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <HeaderSection
          title="AI Tool"
          subtitle="AI Flowchart Maker"
          description="Transform your ideas into professional flowcharts instantly with the power of artificial intelligence. No design experience required."
          titleAs="h1"
          subtitleAs="h2"
          className="mb-16"
        />

        {/* Hero Image */}
        <div className="mb-16">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border shadow-lg">
            <Image
              src="https://cdn.flowchartai.org/static/demo.png"
              alt="AI Flowchart Maker Demo"
              width={1200}
              height={800}
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="mb-16 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-8 border">
            <h3 className="text-2xl font-semibold mb-4">
              Ready to Create Your First AI Flowchart?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Start creating professional flowcharts with our AI-powered tool. Just describe your process and watch it come to life.
            </p>
            <LocaleLink href="/canvas">
              <Button size="lg" className="gap-2">
                Start Creating Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </LocaleLink>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <HeaderSection
            subtitle="Why Choose Our AI Flowchart Maker?"
            description="Discover the powerful features that make creating flowcharts effortless and efficient."
            className="mb-12"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="border-2 hover:border-primary/20 transition-colors">
                  <CardHeader>
                    <div className="p-2 rounded-lg bg-primary/10 w-fit mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mb-16">
          <HeaderSection
            subtitle="Perfect for Every Use Case"
            description="Our AI flowchart maker adapts to your specific needs, whether you're mapping business processes or designing system architectures."
            className="mb-12"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                <span className="font-medium">{useCase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <HeaderSection
            subtitle="How It Works"
            description="Creating professional flowcharts has never been easier. Follow these simple steps to get started."
            className="mb-12"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="text-lg font-semibold mb-2">Describe Your Process</h4>
              <p className="text-muted-foreground">
                Simply type or speak your process description in natural language.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="text-lg font-semibold mb-2">AI Creates Your Flowchart</h4>
              <p className="text-muted-foreground">
                Our AI analyzes your description and generates a professional flowchart instantly.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="text-lg font-semibold mb-2">Customize & Share</h4>
              <p className="text-muted-foreground">
                Edit, customize, and share your flowchart with your team or export it for presentations.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold mb-4">
                Start Creating Professional Flowcharts Today
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join thousands of professionals who trust our AI-powered flowchart maker to visualize their processes and ideas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <LocaleLink href="/canvas">
                  <Button size="lg" className="gap-2">
                    Try Free Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </LocaleLink>
                <LocaleLink href="/tools">
                  <Button size="lg" variant="outline" className="gap-2">
                    Explore More Tools
                  </Button>
                </LocaleLink>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
