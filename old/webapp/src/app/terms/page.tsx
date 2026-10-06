export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background py-20 px-4">
            <div className="container mx-auto max-w-4xl">
                <h1 className="text-4xl font-display font-bold mb-8">Terms of Service</h1>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="text-lg text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">1. Indemnification and Hold Harmless</h2>
                        <p className="text-justify leading-relaxed">
                            Upon utilizing the FBupload Pro infrastructure (&quot;The Service&quot;), the Client Agency (&quot;The User&quot;) hereby agrees to irrevocably, unconditionally, and absolutely indemnify, defend, and hold harmless FBupload Pro, its officers, directors, stakeholders, employees, agents, and affiliates (collectively, &quot;Indemnitees&quot;) from and against any and all claims, liabilities, damages, losses, costs, expenses, fees (including reasonable attorneys&apos; fees and court costs) that such Indemnitees may incur as a result of or arising from: (a) any content, media, or data uploaded, posted, or otherwise transmitted by The User via The Service; (b) any violation of third-party rights, including but not limited to intellectual property rights, privacy rights, or publicity rights; (c) any breach of applicable laws, regulations, or statutes in any jurisdiction.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">2. Limitation of Vicarious Liability</h2>
                        <p className="text-justify leading-relaxed">
                            Notwithstanding anything to the contrary herein, FBupload Pro shall explicitly not be held vicariously, overtly, or implicitly liable for the operational conduct, strategic decisions, or content governance of The User. The Service acts exclusively as a neutral technological intermediary. The User retains singular, non-transferable, and absolute dominion over the selection, timing, and nature of all outgoing transmissions. FBupload Pro disclaims any duty to monitor, police, or verify the authenticity or legality of User-generated actions. Use of The Service constitutes an express waiver of legal recourse against FBupload Pro for any adverse consequences resulting from third-party platform enforcement actions, including account termination or suspension.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">3. Assumption of Risk and Sole Responsibility</h2>
                        <p className="text-justify leading-relaxed">
                            The User expressly acknowledges that the utilization of automated distribution tools carries inherent risks regarding compliance with third-party Terms of Service (e.g., Meta Platform Policies). The User assumes full, undivided, and rigorous responsibility for ensuring their usage of The Service aligns with all external contractual obligations. FBupload Pro provides no warranty, guarantee, or assurance of immunity from third-party algorithmic detection or penalty. The User proceeds at their own peril and sole discretion.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">4. Severability and Force Majeure</h2>
                        <p className="text-justify leading-relaxed">
                            If any provision of this Agreement is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
