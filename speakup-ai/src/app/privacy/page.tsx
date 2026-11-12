import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="12 November 2026">
      <p>This policy explains what SpeakUp AI collects and why. We follow data minimisation: we only process what is needed to help you practise English. The operator of this installation should review this template and add their legal entity name and contact details before launch.</p>
      <h2>Guest mode</h2>
      <p>Without an account, your profile, answers (as text), scores and progress are stored only in your browser&apos;s local storage on your device. We do not receive them. Clearing your browser data deletes them permanently.</p>
      <h2>Accounts</h2>
      <p>If you create an account, we store your email address, password hash (handled by our authentication provider, Supabase), learning preferences, practice transcripts, scores, streaks and achievements so you can use them on any device. Data is protected by row-level security so that only you can read your records.</p>
      <h2>Voice and audio</h2>
      <ul>
        <li>We do <b>not</b> record or store your voice. Speech recognition is performed by your browser. Some browsers (for example Google Chrome) send audio to their own speech service to transcribe it; this is governed by the browser vendor&apos;s privacy policy.</li>
        <li>If you enable &ldquo;play back my own voice&rdquo;, the audio stays in your browser tab&apos;s memory and is discarded when you leave the page.</li>
        <li>Only the text transcript of your answer is saved.</li>
      </ul>
      <h2>Optional AI features</h2>
      <p>AI mode is off by default. If you turn it on and give consent, the text of the answer you are checking (not your name, email or audio) is sent via our server to the configured AI provider. If you add your own API key, it is stored only in your browser and is forwarded to the provider with each request but never saved on our servers. We log the number of AI requests and token counts (not the content) to enforce limits and control costs.</p>
      <h2>Leaderboards and sharing</h2>
      <p>You only appear on the public leaderboard if you opt in, and only your display name, weekly XP and streak are shown. Sharing to WhatsApp or other apps only happens when you tap a share button; we never message your contacts.</p>
      <h2>Your rights</h2>
      <ul>
        <li>Download your data at any time from Settings.</li>
        <li>Delete data on your device, or permanently delete your account and all associated cloud data, from Settings.</li>
        <li>Contact the operator to request access, correction or deletion.</li>
      </ul>
      <h2>Children</h2>
      <p>SpeakUp AI is intended for learners aged 13 and above. Younger learners should use it with a parent or teacher.</p>
      <h2>Security</h2>
      <p>Traffic is encrypted with HTTPS. Secret keys are kept on the server. No method of storage is 100% secure, but we take reasonable measures to protect your data.</p>
    </LegalPage>
  );
}
