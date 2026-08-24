import {
  ArrowRight,
  ChartBar,
  Clock,
  Info,
  Pulse,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import type { EpisodeCohortReview } from "./episodeCohort";
import type { EpisodeCohort, EpisodeCohortMember } from "./types/rolo";
import "./episode-cohort.css";

const METRIC_LABELS = {
  duration_ms: "Duration",
  event_count: "Events",
  finding_count: "Findings",
  asset_count: "Assets",
  evidence_count: "Evidence",
} as const;

function formatMetric(metric: string, value: number | null): string {
  if (value === null) return "Not available";
  if (metric !== "duration_ms") return String(value);
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} s`;
}

function CategoryCounts({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <section className="episode-cohort-categories">
      <h4>{title}</h4>
      <dl>{Object.entries(values).map(([label, count]) => (
        <div key={label}><dt>{label.replaceAll("_", " ")}</dt><dd>{count}</dd></div>
      ))}</dl>
    </section>
  );
}

function MemberRow({ member, onOpen }: { member: EpisodeCohortMember; onOpen: () => void }) {
  return (
    <button className="episode-cohort-member" onClick={onOpen}>
      <span><strong>{member.task_label}</strong><code>{member.episode_id} · rev {member.revision}</code></span>
      <time>{new Date(member.started_at).toLocaleString()}</time>
      <span>{formatMetric("duration_ms", member.duration_ms)}</span>
      <span>{member.outcome}</span>
      <span>{member.verification.replaceAll("_", " ")}</span>
      <ArrowRight size={14} />
    </button>
  );
}

export function EpisodeCohortView({
  cohort,
  review,
  loading,
  message,
  windowDays,
  disabled,
  onWindowDays,
  onOpenMember,
}: {
  cohort: EpisodeCohort | null;
  review: EpisodeCohortReview | null;
  loading: boolean;
  message: string;
  windowDays: 7 | 30 | 90;
  disabled: boolean;
  onWindowDays: (days: 7 | 30 | 90) => void;
  onOpenMember: (member: EpisodeCohortMember) => void;
}) {
  return (
    <section className="episode-cohort panel" aria-label="Exact-match Episode cohort review">
      <header className="episode-cohort-heading">
        <div><ChartBar size={20} /><span><small>DESCRIPTIVE ONLY</small><h3>Exact-match cohort</h3><p>Current immutable publications from other Episode identities. No verdict or release signal is derived.</p></span></div>
        <label className="select-control"><Clock size={14} /><select value={windowDays} disabled={disabled} onChange={(event) => onWindowDays(Number(event.target.value) as 7 | 30 | 90)} aria-label="Episode cohort time window"><option value={7}>Previous 7 days</option><option value={30}>Previous 30 days</option><option value={90}>Previous 90 days</option></select></label>
      </header>

      {loading && <div className="episode-cohort-state"><Pulse size={20} /><span><strong>Reading exact-match publications</strong><small>The server derives identity and the closed-open window from the pinned revision.</small></span></div>}
      {message && <div className="episode-cohort-state is-error" role="alert"><WarningCircle size={20} weight="fill" /><span><strong>Cohort not comparable</strong><small>{message}</small></span></div>}

      {cohort && review && <>
        <div className="episode-cohort-summary">
          <div><small>Exact identity</small><strong>{cohort.operation}</strong><code>{cohort.test_case_id}</code></div>
          <dl>
            <div><dt>Included</dt><dd>{cohort.included_count}</dd></div>
            <div><dt>Excluded</dt><dd>{cohort.excluded_count}</dd></div>
            <div><dt>Truncated</dt><dd>{cohort.truncated_count}</dd></div>
            <div><dt>Population</dt><dd>{cohort.population_count}</dd></div>
          </dl>
          <span><small>Window</small><time>{new Date(cohort.window_started_at).toLocaleString()} — {new Date(cohort.window_ended_at).toLocaleString()}</time><small>As of {new Date(cohort.as_of).toLocaleString()}</small></span>
        </div>

        {cohort.coverage === "BOUNDED_PARTIAL" && <div className="episode-cohort-partial"><ShieldWarning size={17} /><span><strong>Bounded partial population</strong><small>All summaries below describe only the {cohort.included_count} returned members.</small></span></div>}

        <div className="episode-cohort-distributions">{review.distributions.map((item) => (
          <article key={item.metric}>
            <header><span>{METRIC_LABELS[item.metric]}</span><small>{item.authority.replaceAll("_", " ")}</small></header>
            <strong>{formatMetric(item.metric, item.median)} <small>median</small></strong>
            <dl><div><dt>Min</dt><dd>{formatMetric(item.metric, item.minimum)}</dd></div><div><dt>Max</dt><dd>{formatMetric(item.metric, item.maximum)}</dd></div><div><dt>Reference</dt><dd>{formatMetric(item.metric, item.reference)}</dd></div><div><dt>Count</dt><dd>{item.count}</dd></div></dl>
          </article>
        ))}</div>

        <div className="episode-cohort-category-grid">
          <CategoryCounts title="Execution outcome" values={review.outcomes} />
          <CategoryCounts title="Independent verification" values={review.verifications} />
          <CategoryCounts title="Publication coverage" values={review.publicationCoverage} />
        </div>

        <section className="episode-cohort-members">
          <header><span><h4>Newest-first members</h4><small>Outcome and verification remain separate.</small></span><code>current publications only</code></header>
          {cohort.items.length > 0
            ? <div><div className="episode-cohort-member is-header"><span>Episode</span><span>Started</span><span>Duration</span><span>Outcome</span><span>Verification</span><i /></div>{cohort.items.map((member) => <MemberRow key={`${member.episode_id}-${member.revision}`} member={member} onOpen={() => onOpenMember(member)} />)}</div>
            : <div className="episode-cohort-empty"><Info size={18} /><span><strong>No eligible members</strong><small>The exact identity and selected window produced no immutable current publications from other Episode IDs.</small></span></div>}
        </section>

        {(cohort.excluded_count > 0 || cohort.limitations.length > 0) && <footer className="episode-cohort-limitations"><WarningCircle size={16} weight="fill" /><span><strong>{cohort.exclusions.running} running · {cohort.exclusions.mutable} mutable excluded</strong>{cohort.limitations.map((limitation) => <small key={limitation}>{limitation}</small>)}</span></footer>}
      </>}
    </section>
  );
}
