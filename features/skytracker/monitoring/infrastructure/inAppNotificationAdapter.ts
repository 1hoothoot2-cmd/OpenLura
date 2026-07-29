import type { InAppNotificationAdapter } from "../application/notificationDeliveryService.ts";

export function createInAppNotificationAdapter(): InAppNotificationAdapter {
  return {
    async deliver() {
      return "delivered";
    },
  };
}
