/**
 * Type declarations per Google Identity Services (GSI) — One Tap.
 * Riferimento: https://developers.google.com/identity/gsi/web/reference
 * La libreria viene caricata dinamicamente (https://accounts.google.com/gsi/client)
 * e definisce `window.google.accounts.id`.
 */

export {};

interface GoogleIdentityInitializeConfig {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
  use_fedcm_for_prompt?: boolean;
  allowed_parent_origin?: string | string[];
  prompt_parent_id?: string;
  ux_mode?: 'popup' | 'redirect';
  login_uri?: string;
  context?: string;
  native_callback?: (response: unknown) => void;
}

interface GoogleIdentityPromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  getNotDisplayedReason(): string;
  getSkippedReason(): string;
  isDisplayed(): boolean;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: GoogleIdentityInitializeConfig): void;
          prompt(listener?: (notification: GoogleIdentityPromptNotification) => void): void;
          cancel(): void;
          revoke(token: string, done?: (response: unknown) => void): void;
          disableAutoSelect(): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
          storeCredential(credential: string, callback?: () => void): void;
        };
      };
    };
  }
}