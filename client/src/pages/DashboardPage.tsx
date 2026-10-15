import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { PageBanner } from "@/components/ui/PageBanner";
import { Tile, TileLabel, type TileTone } from "@/components/ui/Tile";
import { friendlyErrorMessage } from "@/api/client";
import { getBillingSummary, getCreditTransactions, type BillingSummary, type CreditTransaction } from "@/api/billing";
import { Reveal, hoverLift, rowItem, staggerContainer, staggerItem } from "@/components/ui/motion";

/** Cards count in one after another, like the stats being tallied up. */
const statGridVariants = staggerContainer(0.08, 0.1);
const statCardVariants = staggerItem;

function MetricTile({ title, items, tone, note, className }: { title: string; items: Array<[string, string | number]>; tone: TileTone; note?: string; className?: string }) {
  return (
    <motion.div variants={statCardVariants} {...hoverLift} className={className}>
      <Tile tone={tone} className="h-full transition-shadow duration-300 hover:shadow-lift">
        <TileLabel>{title}</TileLabel>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {items.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-stone-500">{label}</dt>
              <dd className="break-words font-display text-2xl tabular-nums text-stone-900">{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="mt-3 text-xs text-stone-600">{note}</p>}
      </Tile>
    </motion.div>
  );
}

const TX_TONE: Record<string, "success" | "danger" | "neutral" | "warning"> = {
  purchase: "success",
  generation_hold: "neutral",
  generation_release: "success",
  refund: "warning",
  adjustment: "neutral",
  promotional: "success",
};

export function DashboardPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getBillingSummary(), getCreditTransactions()])
      .then(([s, t]) => {
        setSummary(s);
        setTransactions(t.slice(0, 8));
      })
      .catch((err) => setError(friendlyErrorMessage(err, "We couldn't load your dashboard.")));
  }, []);

  if (error) {
    return (
      <PageContainer className="max-w-6xl">
        <ErrorState message={error} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-6xl">
      <PageBanner
        scene="mosaic"
        badge="Control Center • Studio Overview"
        title="Trial Room Dashboard"
        subtitle="Track customer room scans, in-situ generation metrics, showroom credit balance, and transaction history."
        actions={
          <>
            <Link to="/upload">
              <Button size="lg" className="bg-clay-500 hover:bg-clay-400 text-stone-950 font-semibold shadow-md">
                Launch New Trial →
              </Button>
            </Link>
            <Link to="/credits">
              <Button size="lg" variant="outline" className="border-stone-300 bg-white/80 text-stone-900 hover:bg-white">
                Top Up Credits
              </Button>
            </Link>
          </>
        }
      />

      {!summary ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading dashboard">
          <Skeleton className="h-56 rounded-2xl lg:col-span-3 lg:row-span-2 lg:h-auto" />
          <Skeleton className="h-36 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-36 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-32 rounded-2xl lg:col-span-6" />
        </div>
      ) : (
        <>
          {/* Bento layout: one big balance tile, then grouped metric tiles of different widths */}
          <motion.div className="mt-8 grid gap-4 lg:grid-cols-6" variants={statGridVariants} initial="hidden" animate="show">
            <motion.div variants={statCardVariants} className="lg:col-span-3 lg:row-span-2">
              <Tile tone="feature" className="relative flex h-full flex-col justify-between gap-6 overflow-hidden p-6 sm:p-7">
                {/* Slow ambient glow drifting over the balance tile. */}
                <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float rounded-full bg-white/10 blur-3xl" />
                <div className="relative">
                  <TileLabel>Available trial balance</TileLabel>
                  <p className="mt-2 font-display text-5xl font-bold tabular-nums text-white sm:text-6xl">
                    <AnimatedNumber value={summary.balance} />
                  </p>
                  <p className="mt-1 text-sm text-teal-50">credits</p>
                  {summary.balance <= 20 && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.6 }}
                      className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      {summary.balance === 0 ? "You've used all available credits." : "Your credits are running low."}
                    </motion.p>
                  )}
                </div>
                <div className="relative flex flex-wrap gap-3">
                  <Link to="/credits">
                    <Button size="lg" className="bg-white text-stone-900 hover:bg-teal-50">
                      Top up balance
                    </Button>
                  </Link>
                  <Link to="/upload">
                    <Button size="lg" variant="outline" className="border-white/60 text-white hover:bg-white/15">
                      Start a trial
                    </Button>
                  </Link>
                </div>
              </Tile>
            </motion.div>

            <MetricTile className="lg:col-span-3" tone="sky" title="Credits used" items={[["Today", summary.used.today], ["This week", summary.used.week], ["This month", summary.used.month], ["All time", summary.used.total]]} note={summary.used.reserved > 0 ? `${summary.used.reserved} credits reserved for running previews` : undefined} />
            <MetricTile className="lg:col-span-3" tone="soft" title="Trial renderings" items={[["Total", summary.generations.total], ["Successful", summary.generations.completed], ["Failed", summary.generations.failed], ["In progress", summary.generations.inProgress]]} />
            <MetricTile className="lg:col-span-6" tone="sun" title="Payments & passes" items={[["Total paid", `₹${(summary.payments.paidPaise / 100).toLocaleString()}`], ["Successful", summary.payments.paid], ["Pending", summary.payments.pending], ["Failed", summary.payments.failed]]} />
          </motion.div>

          <Reveal as="section" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-stone-900">Recent transactions</h2>
              <Link to="/credits" className="group inline-flex items-center gap-1 text-sm font-medium text-clay-700 transition-colors hover:text-clay-800">
                <span className="link-underline">View all</span>
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
            {transactions.length === 0 ? (
              <Card className="mt-3">
                <p className="px-4 py-6 text-center text-sm text-stone-500">No transactions yet.</p>
              </Card>
            ) : (
              <>
                {/* Phone: a stacked list of cards — a 6-column table forced
                    into a narrow viewport is unreadable even with scroll. */}
                <motion.ul className="mt-3 space-y-2.5 sm:hidden" variants={staggerContainer(0.05)} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  {transactions.map((t) => (
                    <motion.li key={t.id} variants={rowItem}>
                      <Card className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Badge tone={TX_TONE[t.type] ?? "neutral"}>{t.type.replace(/_/g, " ")}</Badge>
                            <p className="mt-1.5 break-words text-sm text-stone-700">{t.description}</p>
                          </div>
                          <p className={`shrink-0 text-right font-display text-lg font-semibold ${t.amount >= 0 ? "text-emerald-700" : "text-stone-900"}`}>
                            {t.amount > 0 ? "+" : ""}
                            {t.amount}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stone-100 pt-2.5 text-xs text-stone-500">
                          <span>{new Date(t.createdAt).toLocaleString()}</span>
                          <span>
                            Balance {t.balanceAfter} · {t.status}
                          </span>
                        </div>
                      </Card>
                    </motion.li>
                  ))}
                </motion.ul>

                {/* Tablet and up: the full table */}
                <Card className="scroll-soft mt-3 hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Credits</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <motion.tbody variants={staggerContainer(0.04)} initial="hidden" whileInView="show" viewport={{ once: true }}>
                      {transactions.map((t) => (
                        <motion.tr
                          key={t.id}
                          variants={rowItem}
                          className="border-b border-stone-100/80 transition-colors duration-200 last:border-0 hover:bg-surface-sage/40"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-stone-500">{new Date(t.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge tone={TX_TONE[t.type] ?? "neutral"}>{t.type.replace(/_/g, " ")}</Badge>
                          </td>
                          <td className="px-4 py-3 text-stone-700">{t.description}</td>
                          <td className={`px-4 py-3 text-right font-medium ${t.amount >= 0 ? "text-emerald-700" : "text-stone-900"}`}>
                            {t.amount > 0 ? "+" : ""}
                            {t.amount}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-500">{t.balanceAfter}</td>
                          <td className="px-4 py-3 text-stone-500">{t.status}</td>
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </Card>
              </>
            )}
          </Reveal>
        </>
      )}
    </PageContainer>
  );
}
