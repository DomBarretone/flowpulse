import type { ComponentProps } from 'react';
import type { ClerkProvider } from '@clerk/nextjs';

type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

/**
 * Tema escuro customizado para componentes Clerk no FlowPulse.
 *
 * Configurado estritamente via Appearance API oficial do Clerk (@clerk/nextjs),
 * garantindo legibilidade e conformidade com WCAG 2.1 AA sem modificações
 * de CSS global ou sobrescritas frágeis.
 */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    colorBackground: '#18181b', // zinc-900
    colorNeutral: '#f4f4f5', // zinc-100 (neutro claro para contraste em modo escuro)
    colorPrimary: '#7c6cf2', // Roxo FlowPulse
    colorPrimaryForeground: '#ffffff',
    colorForeground: '#f4f4f5', // zinc-100 (texto principal de alto contraste)
    colorMutedForeground: '#a1a1aa', // zinc-400 (textos secundários e legendas)
    colorMuted: '#27272a', // zinc-800
    colorInput: '#27272a', // zinc-800 (fundo de inputs)
    colorInputForeground: '#f4f4f5', // zinc-100 (texto digitado)
    colorBorder: '#27272a', // zinc-800 (bordas discretas)
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorModalBackdrop: 'rgba(0, 0, 0, 0.75)',
  },
  elements: {
    // Card & Modal
    card: 'bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100',
    modalBackdrop: 'bg-black/75 backdrop-blur-sm',
    modalContent: 'bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl',
    modalCloseButton: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',

    // Cabeçalhos & Títulos
    headerTitle: 'text-zinc-100 font-bold',
    headerSubtitle: 'text-zinc-400',

    // Formulários & Inputs
    formFieldLabel: 'text-zinc-200 font-medium',
    formFieldInput:
      'bg-zinc-800/80 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500',
    formFieldAction: 'text-indigo-400 hover:text-indigo-300 font-medium',
    formFieldErrorText: 'text-red-400 text-xs mt-1',
    formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-medium',

    // Divisores & Rodapé
    dividerLine: 'bg-zinc-800',
    dividerText: 'text-zinc-400',
    footer: 'bg-transparent',
    footerActionText: 'text-zinc-400',
    footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-medium',

    // Botões sociais & Prévia de identidade
    socialButtonsBlockButton: 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700',
    socialButtonsBlockButtonText: 'text-zinc-200 font-medium',
    identityPreviewText: 'text-zinc-200',
    identityPreviewEditButton: 'text-indigo-400 hover:text-indigo-300',

    // User Profile Modal (Sidebar, Seções e Ações)
    navbar: 'bg-zinc-900 border-r border-zinc-800',
    navbarButtons: 'gap-1',
    navbarButton: 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 font-medium',
    navbarButtonIcon: 'text-zinc-400',
    navbarMobileMenuButton: 'text-zinc-300 hover:text-zinc-100',
    profilePage: 'bg-zinc-900 text-zinc-100',
    profilePageContent: 'text-zinc-100',
    profileSection: 'border-b border-zinc-800',
    profileSectionHeader: 'border-zinc-800',
    profileSectionTitle: 'text-zinc-100 font-semibold',
    profileSectionTitleText: 'text-zinc-100 font-semibold',
    profileSectionSubtitle: 'text-zinc-400',
    profileSectionSubtitleText: 'text-zinc-400',
    profileSectionContent: 'text-zinc-200',
    profileSectionItem: 'border-zinc-800 text-zinc-200',
    profileSectionPrimaryButton: 'text-indigo-400 hover:text-indigo-300 font-medium',
    badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',

    // Menus & Ações do Popover de Usuário
    menuList: 'bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-xl',
    menuItem: 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800',
    menuButton: 'text-zinc-300 hover:text-zinc-100',
    userButtonAvatarBox: 'w-8 h-8 border border-zinc-700',
    userButtonPopoverCard: 'bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-xl',
    userPreviewMainIdentifier: 'text-zinc-100 font-semibold',
    userPreviewSecondaryIdentifier: 'text-zinc-400',
    userButtonPopoverActionButton: 'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800',
    userButtonPopoverActionButtonIcon: 'text-zinc-400',
    userButtonPopoverActionButtonText: 'text-zinc-200',
    userButtonPopoverFooter: 'hidden',
  },
};
