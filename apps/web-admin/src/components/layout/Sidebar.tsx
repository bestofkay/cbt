import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, cn, Separator } from '@cbt/ui';

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'nav.sections.people',
    items: [
      { to: '/', labelKey: 'nav.dashboard', end: true },
      { to: '/users', labelKey: 'nav.users' },
      { to: '/roles', labelKey: 'nav.roles' },
    ],
  },
  {
    titleKey: 'nav.sections.content',
    items: [
      { to: '/question-banks', labelKey: 'nav.questionBanks' },
      { to: '/exams', labelKey: 'nav.exams' },
      { to: '/taxonomy', labelKey: 'nav.taxonomy' },
    ],
  },
  {
    titleKey: 'nav.sections.quality',
    items: [
      { to: '/reviews/questions', labelKey: 'nav.reviewQuestions' },
      { to: '/reviews/manual', labelKey: 'nav.reviewManual' },
    ],
  },
  {
    titleKey: 'nav.sections.delivery',
    items: [
      { to: '/sessions', labelKey: 'nav.sessions' },
      { to: '/results', labelKey: 'nav.results' },
    ],
  },
  {
    titleKey: 'nav.sections.finance',
    items: [
      { to: '/billing', labelKey: 'nav.billing' },
      { to: '/catalog', labelKey: 'nav.catalog' },
    ],
  },
  {
    titleKey: 'nav.sections.system',
    items: [
      { to: '/notifications', labelKey: 'nav.notifications' },
      { to: '/support', labelKey: 'nav.support' },
      { to: '/security', labelKey: 'nav.security' },
      { to: '/settings', labelKey: 'nav.settings' },
    ],
  },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.mainNavigation')} className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      {navSections.map((section, sectionIndex) => (
        <div key={section.titleKey} className={sectionIndex > 0 ? 'mt-5' : undefined}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-700/70">
            {t(section.titleKey)}
          </p>
          <ul className="space-y-0.5" role="list">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 hover:bg-primary-50 hover:text-primary-900',
                    )
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
          {sectionIndex < navSections.length - 1 ? <Separator className="mt-4" /> : null}
        </div>
      ))}
    </nav>
  );
}

export function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles.length) return null;

  return (
    <div className="flex flex-wrap gap-1" aria-label="User roles">
      {roles.map((role) => (
        <Badge key={role} variant="secondary" className="text-[10px]">
          {role.replace(/_/g, ' ')}
        </Badge>
      ))}
    </div>
  );
}
