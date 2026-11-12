import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="12 November 2026">
      <p>By using SpeakUp AI you agree to these terms. The operator of this installation should review them with a legal adviser before commercial launch.</p>
      <h2>The service</h2>
      <p>SpeakUp AI provides English practice tools: a speaking coach, grammar feedback, a 30-day program, IELTS-style practice, an interview simulator and vocabulary training. The core service is free. Optional paid features may be introduced later; you will never be charged without clearly agreeing to a paid plan.</p>
      <h2>No guarantees</h2>
      <ul>
        <li>Scores, band estimates and feedback are automated estimates for practice. They are not official assessments and may be inaccurate.</li>
        <li>We do not guarantee fluency, any IELTS band, or job offers. Results depend on your practice.</li>
        <li>SpeakUp AI is not affiliated with or endorsed by the owners of the IELTS test. All practice material is original.</li>
      </ul>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not misuse the service, attempt to bypass usage limits, or submit unlawful, abusive or personal-sensitive content.</li>
        <li>Do not use automated scripts to send requests to AI features.</li>
        <li>If you add your own AI API key, you are responsible for your provider&apos;s charges and terms.</li>
      </ul>
      <h2>Content</h2>
      <p>You keep ownership of what you write and say. You grant us permission to store and process it only to provide the service to you.</p>
      <h2>Availability</h2>
      <p>The service is provided &ldquo;as is&rdquo;. Free tiers of our hosting and AI providers have limits, so features may be temporarily unavailable.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Continued use after changes means you accept them.</p>
    </LegalPage>
  );
}
