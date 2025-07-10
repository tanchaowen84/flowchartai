import { HeaderSection } from '@/components/layout/header-section';
import { useTranslations } from 'next-intl';

export default function ComparisonSection() {
  const t = useTranslations('HomePage.comparison');

  return (
    <section id="comparison" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-16">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Traditional Tools */}
          <div className="lg:pr-0">
            <div className="mb-8">
              <h3 className="text-2xl font-semibold">
                {t('traditional.title')}
              </h3>
              <p className="mt-4 text-muted-foreground">
                {t('traditional.subtitle')}
              </p>
            </div>

            <ul className="space-y-4">
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-1')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-2')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-3')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-4')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-5')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-6')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-7')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('traditional.item-8')}
                </span>
              </li>
            </ul>
          </div>

          {/* FlowChart AI */}
          <div className="lg:pl-0">
            <div className="mb-8">
              <h3 className="text-2xl font-semibold">
                {t('flowchartAi.title')}
              </h3>
              <p className="mt-4 text-muted-foreground">
                {t('flowchartAi.subtitle')}
              </p>
            </div>

            <ul className="space-y-4">
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-1')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-2')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-3')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-4')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-5')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-6')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-7')}
                </span>
              </li>
              <li className="pb-4 border-b border-dashed">
                <span className="text-sm leading-relaxed">
                  {t('flowchartAi.item-8')}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
