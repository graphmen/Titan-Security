import { deliverAndSummarize } from './whatsapp';
import { deliverGuardPinEmail, deliverSupervisorPinEmail } from './email';
import { getLocalState } from './localStore';

/** Deliver WhatsApp queue + email PIN after guard/supervisor register / PIN reset. */
export async function deliverPinNotifications(result, action, tenantId) {
  const whatsapp = await deliverAndSummarize(getLocalState(), tenantId, result.whatsappEntryId);

  let email = null;
  if (result?.generatedPin && result?.guard) {
    const pinType = action === 'RESET_GUARD_PIN' ? 'pin_reset' : 'welcome_pin';
    email = await deliverGuardPinEmail(result.guard, result.generatedPin, pinType);
  } else if (result?.generatedPin && result?.supervisor) {
    const pinType = action === 'RESET_SUPERVISOR_PIN' ? 'pin_reset' : 'welcome_pin';
    email = await deliverSupervisorPinEmail(result.supervisor, result.generatedPin, pinType);
  }

  return { whatsapp, email };
}
