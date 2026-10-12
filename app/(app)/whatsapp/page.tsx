import type { Metadata } from "next";
import { WhatsAppDesk } from "@/components/whatsapp/WhatsAppDesk";

export const metadata: Metadata = { title: "WhatsApp desk" };

export default function WhatsAppPage() {
  return <WhatsAppDesk />;
}
