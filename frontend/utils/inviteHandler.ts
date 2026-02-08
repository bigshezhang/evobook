/**
 * Invite code handling utilities.
 * 
 * Manages storing and processing invite codes from URL parameters.
 */

import { bindInviteCode } from './api';

const STORAGE_KEY = 'pending_invite_code';

/**
 * Store an invite code to localStorage for later binding.
 * 
 * @param code - Invite code to store
 */
export function storeInviteCode(code: string): void {
  localStorage.setItem(STORAGE_KEY, code);
}

/**
 * Get pending invite code from localStorage.
 * 
 * @returns Invite code or null if not found
 */
export function getPendingInviteCode(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Clear pending invite code from localStorage.
 */
export function clearPendingInviteCode(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Process pending invite code by binding it to the current user.
 * 
 * @returns Result with success status and optional message
 */
export async function processPendingInvite(): Promise<{ success: boolean; message?: string }> {
  const code = getPendingInviteCode();
  if (!code) {
    return { success: false };
  }

  try {
    const result = await bindInviteCode(code);
    clearPendingInviteCode();
    return {
      success: true,
      message: result.reward?.message
    };
  } catch (error) {
    clearPendingInviteCode();
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process invite'
    };
  }
}
