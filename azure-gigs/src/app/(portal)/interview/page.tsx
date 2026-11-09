import { PageHeader } from "@/components/page";
import { Incidents, MockInterview, QuestionBank } from "@/components/interview";
import { FAULT_LIST } from "@/lib/labs/incidents";
import { INTERVIEW_QUESTIONS } from "@/content/paths";
export const metadata = { title: "Interview Preparation" };
export default async function Page({ searchParams }: { searchParams: Promise<{ incident?: string }> }) {
  const { incident } = await searchParams;
  return (
    <>
      <PageHeader title="Interview Preparation" subtitle="Injected-fault troubleshooting (scored on methodology, root cause, resolution, verification and RCA), mock interviews and a question bank." crumbs={[{ label: "Interview Preparation" }]} />
      <div className="grid gap-6">
        <section aria-labelledby="inc"><h2 id="inc" className="mb-2 text-base font-semibold">Production incidents</h2><Incidents faults={FAULT_LIST} focus={incident} /></section>
        <MockInterview questions={INTERVIEW_QUESTIONS.map(({ topic, level, q }) => ({ topic, level, q }))} />
        <QuestionBank questions={INTERVIEW_QUESTIONS} />
      </div>
    </>
  );
}
