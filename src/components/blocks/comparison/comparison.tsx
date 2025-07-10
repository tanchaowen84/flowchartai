import { HeaderSection } from '@/components/layout/header-section';
import { Card } from '@/components/ui/card';
import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ComparisonSection() {
  const t = useTranslations('HomePage.comparison');

  return (
    <section id="comparison" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <ComparisonCard
            title={t('traditional.title')}
            subtitle={t('traditional.subtitle')}
            items={[
              { text: t('traditional.item-1'), isPositive: false },
              { text: t('traditional.item-2'), isPositive: false },
              { text: t('traditional.item-3'), isPositive: false },
              { text: t('traditional.item-4'), isPositive: false },
            ]}
            isHighlighted={false}
          />

          <ComparisonCard
            title={t('flowchartAi.title')}
            subtitle={t('flowchartAi.subtitle')}
            items={[
              { text: t('flowchartAi.item-1'), isPositive: true },
              { text: t('flowchartAi.item-2'), isPositive: true },
              { text: t('flowchartAi.item-3'), isPositive: true },
              { text: t('flowchartAi.item-4'), isPositive: true },
            ]}
            isHighlighted={true}
          />
        </div>
      </div>
    </section>
  );
}

const ComparisonCard = ({
  title,
  subtitle,
  items,
  isHighlighted,
}: {
  title: string;
  subtitle: string;
  items: { text: string; isPositive: boolean }[];
  isHighlighted: boolean;
}) => {
  return (
    <Card className={`p-6 ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>

        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              {item.isPositive ? (
                <CheckIcon className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <XIcon className="size-5 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-sm">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
