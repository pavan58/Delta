/** Original interview question bank. keywords drive relevance scoring; tip guides the learner. */
export interface InterviewQuestion {
  q: string;
  keywords: string[];
  tip: string;
  behavioural?: boolean;
  sample?: string;
}

export interface InterviewCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  questions: InterviewQuestion[];
}

const Q = (q: string, keywords: string, tip: string, behavioural = false, sample?: string): InterviewQuestion => ({ q, keywords: keywords.split(",").map((s) => s.trim()), tip, behavioural, sample });

export const INTERVIEW_CATEGORIES: InterviewCategory[] = [
  {
    id: "hr", title: "HR Interview", emoji: "🤝", description: "Personality, motivation and fit questions asked in almost every interview.",
    questions: [
      Q("Tell me about yourself.", "experience, currently, skills, education, graduated, role, interested, goal", "Present → past → future in 60–90 seconds. End with why you're interested in this role.", false,
        "I'm currently working as a technical support engineer at a mid-sized IT services company, where I handle around 30 user tickets a day across Windows, Office 365 and networking issues. I graduated in Computer Science from Pune University in 2022. Over the last two years I've become strong at troubleshooting under pressure and explaining technical problems in simple language. I'm now looking for a role where I can grow into cloud support, which is why this position really interests me."),
      Q("What are your greatest strengths?", "strength, example, team, problem, result, skill", "Pick one or two strengths and prove each with a short real example.", false,
        "One of my biggest strengths is staying calm under pressure. For example, during a network outage last year, I prioritised the most critical users, kept my manager updated every 15 minutes, and we restored service within an hour. My second strength is clear communication — users often tell me they understand my explanations."),
      Q("What is your biggest weakness?", "weakness, improve, working on, learned, now", "Choose a real but non-critical weakness and explain what you're doing to improve it.", false,
        "Earlier in my career I found it hard to say no and took on too many tasks at once. I realised it affected my quality, so now I use a simple priority list and discuss deadlines with my lead before accepting new work. It has helped me deliver more consistently."),
      Q("Why do you want to work for our company?", "company, culture, products, growth, values, role, learn, contribute", "Show you researched the company; connect their work to your goals and skills."),
      Q("Where do you see yourself in five years?", "years, grow, skills, responsibility, lead, learn, company, goal", "Show ambition that fits the company — skills and responsibility, not a different career."),
      Q("Why should we hire you?", "skills, experience, fit, contribute, team, example, value", "Summarise 2–3 strengths that match the job description, with proof."),
      Q("Tell me about a time you handled a conflict at work.", "situation, colleague, listened, discussed, solution, result, learned", "Use STAR. Focus on listening and finding a solution, not blaming.", true),
      Q("What are your salary expectations?", "range, market, research, experience, flexible, negotiable", "Give a researched range, mention flexibility and the overall package."),
      Q("Why are you leaving your current job?", "growth, opportunity, learn, challenge, positive", "Stay positive. Talk about growth, never criticise your current employer."),
    ],
  },
  {
    id: "fresher", title: "Fresher Interview", emoji: "🎓", description: "For final-year students and recent graduates with little or no work experience.",
    questions: [
      Q("Introduce yourself.", "name, graduated, college, degree, project, skills, interested, internship", "Name, education, one project, key skills, why this role.", false,
        "Good morning. I'm Sneha Patil, and I recently completed my B.Tech in Information Technology from a college in Nashik with 8.1 CGPA. In my final-year project, I built a complaint-tracking web app using React and Node.js with two teammates. I'm comfortable with Java, SQL and basic Linux commands. I'm keen to start my career in application support, where I can solve real user problems and keep learning."),
      Q("Tell me about your final-year project.", "project, team, role, technology, problem, result, learned", "Explain the problem, your role, the technology and the result in simple words."),
      Q("Why did you choose your branch of engineering / your degree?", "interest, enjoy, technology, career, learn", "Be honest; connect your interest to the job."),
      Q("What did you learn from your internship?", "internship, learned, team, task, skill, deadline, result", "Mention one technical and one soft skill you gained, with examples."),
      Q("How do you handle pressure, for example during exams?", "plan, prioritise, schedule, calm, example, result", "Describe a concrete method (planning, breaking tasks down) with an example.", true),
      Q("Are you willing to relocate or work in shifts?", "yes, flexible, willing, shifts, relocate, learn", "Be honest and positive; mention any genuine constraints politely."),
      Q("What do you know about our company?", "company, services, clients, products, values, founded", "Mention 2–3 researched facts and why they appeal to you."),
    ],
  },
  {
    id: "desktop", title: "Desktop Support", emoji: "🖥️", description: "L1/L2 desktop support: Windows, hardware, Office, printers and users.",
    questions: [
      Q("A user says their computer is very slow. How do you troubleshoot it?", "task manager, cpu, memory, disk, startup, malware, updates, restart, storage", "Go step by step: gather details, check Task Manager, startup apps, disk space, malware, updates, hardware."),
      Q("How would you fix a printer that is not printing?", "power, connection, queue, spooler, driver, restart, test page, network", "Physical checks → print queue → restart spooler → driver → network/IP → test page."),
      Q("What is the difference between a workgroup and a domain?", "domain, workgroup, active directory, centralised, server, login, policies", "Domain = centralised management via a domain controller; workgroup = peer-to-peer."),
      Q("A user cannot connect to the internet. What steps do you take?", "cable, wifi, ipconfig, ping, dns, gateway, ip address, adapter", "Physical → ipconfig → ping gateway → ping 8.8.8.8 → DNS (nslookup) → adapter reset."),
      Q("How do you handle an angry user who has been waiting for a fix?", "apologise, listen, understand, update, priority, calm, follow up", "Empathise, apologise, give a clear timeline, keep them updated.", true),
      Q("What is BitLocker and why is it used?", "encryption, drive, data, security, recovery key, tpm, lost", "Full-disk encryption to protect data if a device is lost; mention the recovery key."),
      Q("How would you reset a user's password in Active Directory?", "active directory, users and computers, reset, verify, identity, unlock, change at next logon", "Verify identity first, then ADUC → reset → 'must change at next logon' → unlock if needed."),
    ],
  },
  {
    id: "helpdesk", title: "IT Helpdesk", emoji: "🎧", description: "Ticketing, SLAs, first-call resolution and user communication.",
    questions: [
      Q("What is an SLA and why is it important?", "service level agreement, response time, resolution time, priority, customer, commitment", "Define it, then explain response vs resolution time and priority levels."),
      Q("How do you prioritise multiple tickets?", "priority, impact, urgency, sla, business, critical, users affected", "Impact × urgency; critical business systems and many users first."),
      Q("What does first-call resolution mean?", "first call, resolve, without escalation, knowledge base, customer satisfaction", "Solving the issue in the first contact; mention the knowledge base."),
      Q("When should you escalate a ticket?", "escalate, beyond scope, access, sla, l2, documentation, time", "When it's outside your access/skill or SLA is at risk — with good notes."),
      Q("Describe a time you explained a technical problem to a non-technical user.", "simple, explained, user, example, understood, result", "Show you can avoid jargon and confirm understanding.", true),
      Q("Which ticketing tools have you used?", "servicenow, jira, freshdesk, zendesk, remedy, tickets, workflow", "Name tools honestly; describe the workflow you followed."),
      Q("How do you document a resolved ticket?", "steps, root cause, resolution, notes, knowledge base, clear", "Symptoms, steps taken, root cause, resolution, and a KB article if recurring."),
    ],
  },
  {
    id: "techsupport", title: "Technical Support", emoji: "🛠️", description: "Customer-facing technical troubleshooting and communication.",
    questions: [
      Q("Walk me through your troubleshooting approach.", "identify, gather information, reproduce, isolate, test, fix, document, verify", "Identify → gather info → reproduce → isolate → fix → verify → document."),
      Q("What is DNS and how would you troubleshoot a DNS issue?", "domain name system, ip address, nslookup, flush, cache, server, resolve", "Explain DNS simply, then nslookup, ipconfig /flushdns, check DNS server settings."),
      Q("Explain the difference between TCP and UDP.", "tcp, udp, connection, reliable, acknowledgement, faster, streaming", "TCP: connection-oriented & reliable; UDP: connectionless & faster (video, DNS)."),
      Q("Tell me about a difficult customer issue you resolved.", "customer, problem, steps, root cause, resolved, result, feedback", "STAR with the technical steps and the customer outcome.", true),
      Q("How do you stay updated with technology?", "courses, certifications, blogs, practice, lab, community, learn", "Mention specific resources and a recent thing you learned."),
      Q("What would you do if you don't know the answer to a customer's question?", "honest, check, knowledge base, colleague, escalate, follow up, update", "Be honest, set expectations, find out and follow up."),
    ],
  },
  {
    id: "aws", title: "AWS Cloud Support", emoji: "☁️", description: "Core AWS services, troubleshooting and cloud fundamentals.",
    questions: [
      Q("What is the difference between EC2 and S3?", "ec2, virtual server, compute, s3, object storage, bucket, scalable", "EC2 = compute (virtual servers); S3 = object storage for files."),
      Q("An EC2 instance is not reachable over SSH. How do you troubleshoot?", "security group, port 22, key pair, public ip, route table, nacl, status checks, internet gateway", "Status checks → security group port 22 → NACL → route table/IGW → public IP → key pair → OS firewall."),
      Q("What is IAM and why is least privilege important?", "iam, users, roles, policies, permissions, least privilege, security", "Explain IAM entities and why minimal permissions reduce risk."),
      Q("Explain Availability Zones and Regions.", "region, availability zone, data centre, high availability, fault tolerance, latency", "Region = geographic area; AZs = isolated data centres for HA."),
      Q("How would you reduce an AWS bill for a customer?", "rightsizing, reserved instances, savings plans, stop unused, s3 lifecycle, cost explorer, budgets", "Cost Explorer → rightsize → stop idle → RIs/Savings Plans → S3 lifecycle → budgets/alerts."),
      Q("What is CloudWatch used for?", "monitoring, metrics, logs, alarms, dashboards, notifications", "Metrics, logs, alarms and dashboards for AWS resources."),
      Q("Describe how you would explain an outage to a customer.", "impact, root cause, timeline, actions, prevention, apologise, update", "Impact, timeline, root cause, fix, prevention — clearly and honestly.", true),
    ],
  },
  {
    id: "azure", title: "Azure Cloud Support", emoji: "🔷", description: "Azure fundamentals, identity, VMs, networking and support scenarios.",
    questions: [
      Q("What is the difference between Azure AD (Entra ID) and on-premises Active Directory?", "entra id, cloud, identity, on-premises, kerberos, ldap, saml, oauth, sync", "Cloud identity (OAuth/SAML) vs on-prem domain services (Kerberos/LDAP); mention sync."),
      Q("A user cannot RDP to an Azure VM. What do you check?", "nsg, port 3389, public ip, vm running, boot diagnostics, firewall, bastion", "VM state → NSG rule 3389 → public IP/Bastion → boot diagnostics → guest firewall."),
      Q("What are resource groups and why are they useful?", "resource group, container, manage, lifecycle, permissions, billing, tags", "Logical containers for lifecycle, RBAC and cost tracking."),
      Q("Explain Azure RBAC with an example.", "role, scope, assignment, reader, contributor, owner, least privilege", "Role + scope + principal; e.g. Reader on a resource group."),
      Q("What is the difference between Azure Blob Storage tiers?", "hot, cool, cold, archive, access, cost, retrieval", "Hot/Cool/Cold/Archive trade storage cost against access cost and latency."),
      Q("How do you handle a P1 incident affecting many users?", "acknowledge, bridge, communicate, impact, escalate, updates, root cause, post-incident", "Acknowledge fast, open a bridge, regular updates, escalate, RCA afterwards.", true),
    ],
  },
  {
    id: "mainframe", title: "Mainframe Support", emoji: "🗄️", description: "z/OS, JCL, batch jobs and production support.",
    questions: [
      Q("What is JCL and what are its main statements?", "jcl, job, exec, dd, batch, program, dataset", "JOB, EXEC and DD statements; JCL tells z/OS how to run a batch job."),
      Q("A batch job abended with S0C7. What does it mean and what do you do?", "s0c7, data exception, numeric, invalid data, sysout, dump, fix, rerun", "Data exception (invalid numeric data); check SYSOUT/dump, find the bad record, fix, restart."),
      Q("What is the difference between a PS and a PDS dataset?", "sequential, partitioned, members, library, dataset", "PS = sequential file; PDS = library with members."),
      Q("How do you monitor batch jobs in production?", "scheduler, control-m, ca7, sdsf, spool, alerts, abend, sla", "Scheduler (Control-M/CA7), SDSF/spool, alerts, SLA tracking."),
      Q("Describe a production issue you supported and how you communicated it.", "issue, impact, abend, root cause, fix, communicated, stakeholders, result", "STAR: technical fix + clear stakeholder communication.", true),
      Q("What is CICS used for?", "cics, online, transactions, terminal, real-time, programs", "Online transaction processing on the mainframe."),
    ],
  },
  {
    id: "sysadmin", title: "System Administrator", emoji: "🧰", description: "Linux/Windows servers, backups, patching and security.",
    questions: [
      Q("How do you check disk usage and free up space on a Linux server?", "df -h, du, logs, rotate, find, large files, cleanup, tmp", "df -h → du -sh to find large dirs → log rotation → cleanup old files safely."),
      Q("Describe your patching process for production servers.", "schedule, maintenance window, test, backup, approval, rollback, change management, verify", "Test env → change approval → backup/snapshot → patch in window → verify → rollback plan."),
      Q("What is the 3-2-1 backup rule?", "three copies, two media, one offsite, backup, restore, test", "3 copies, 2 media types, 1 offsite — and test restores."),
      Q("A service fails to start after a reboot. How do you troubleshoot?", "systemctl status, journalctl, logs, dependencies, config, permissions, port", "systemctl status → journalctl → config/permissions → dependencies/ports."),
      Q("How do you secure a new server?", "updates, ssh keys, disable root, firewall, least privilege, monitoring, fail2ban", "Patch, SSH keys, disable root login, firewall, least privilege, monitoring."),
      Q("Tell me about an automation you created.", "script, automated, bash, powershell, time saved, result, task", "Describe the manual pain, your script and the measurable time saved.", true),
    ],
  },
  {
    id: "customer", title: "Customer Support", emoji: "💬", description: "Voice/chat process, empathy and problem resolution (BPO/KPO).",
    questions: [
      Q("How would you handle an angry customer?", "listen, empathise, apologise, solution, calm, follow up, understand", "LEAP: Listen, Empathise, Apologise, Problem-solve.", true),
      Q("What does good customer service mean to you?", "listen, solve, respect, quick, empathy, satisfaction, follow up", "Define it with 2–3 qualities and a short example."),
      Q("How do you handle a call when you don't know the answer?", "honest, hold, check, colleague, escalate, call back, update", "Ask permission to place on hold, check, or escalate and promise a callback."),
      Q("Describe a time you went beyond expectations for a customer.", "customer, problem, extra, result, feedback, thank", "STAR with a specific result.", true),
      Q("How would you say no to a customer politely?", "understand, unfortunately, policy, alternative, offer, help", "Acknowledge → explain briefly → offer an alternative."),
      Q("Why do you want to work in customer support?", "people, help, communication, solve, enjoy, skills", "Connect your personality and communication skills to the role."),
    ],
  },
  {
    id: "teamlead", title: "Team Lead", emoji: "🧭", description: "Leading small teams, delegation, performance and stakeholders.",
    questions: [
      Q("How do you motivate a team during a high-pressure period?", "communicate, goals, recognise, support, workload, morale, example", "Clear goals, fair workload, recognition, leading by example.", true),
      Q("How do you handle an under-performing team member?", "one-on-one, expectations, feedback, support, plan, follow up, improvement", "Private conversation, clear expectations, support plan, regular follow-up.", true),
      Q("How do you delegate tasks?", "strengths, skills, ownership, deadline, check-in, growth", "Match tasks to strengths and growth goals; agree deadlines and check-ins."),
      Q("Tell me about a time your team missed a deadline.", "deadline, reason, communicated, stakeholders, recovered, lesson, process", "Own it, explain recovery and the process change you made.", true),
      Q("How do you balance your own technical work with leadership duties?", "prioritise, time, delegate, calendar, support, team first", "Time-blocking, delegation and putting team blockers first."),
      Q("How do you report progress to senior management?", "metrics, status, risks, concise, dashboard, weekly, actions", "Concise status with metrics, risks and actions needed."),
    ],
  },
  {
    id: "manager", title: "Managerial Interview", emoji: "📊", description: "Strategy, people management, budgets and decision-making.",
    questions: [
      Q("Describe your management style.", "collaborative, support, goals, feedback, autonomy, accountability, example", "Name a style, give an example, show you adapt to people.", false),
      Q("How do you make difficult decisions with incomplete information?", "data, risks, options, stakeholders, decide, review, adjust", "Gather what you can, weigh risks, decide, communicate and review.", true),
      Q("How do you manage conflicts between two senior team members?", "listen, both sides, common goal, mediate, agreement, follow up", "Listen separately, find common ground, agree actions, follow up.", true),
      Q("How do you measure your team's success?", "kpi, metrics, sla, customer satisfaction, quality, growth, goals", "KPIs that link to business goals plus people/development measures."),
      Q("Tell me about a change you led and how you managed resistance.", "change, communicated, why, involved, training, feedback, adoption, result", "Explain why, involve people early, train, measure adoption.", true),
      Q("How do you handle budget cuts?", "prioritise, impact, options, stakeholders, efficiency, transparent", "Prioritise by impact, find efficiencies, communicate transparently."),
    ],
  },
];

export const CATEGORY_BY_ID = new Map(INTERVIEW_CATEGORIES.map((c) => [c.id, c]));

export const INTERVIEW_INTROS: Record<string, string> = {
  default: "Hello, and welcome! Thank you for joining today. I'll ask you a few questions, one at a time. Take a moment to think before you answer. Let's begin.",
};
