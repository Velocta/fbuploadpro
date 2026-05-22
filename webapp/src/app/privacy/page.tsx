export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background py-20 px-4">
            <div className="container mx-auto max-w-4xl">
                <h1 className="text-4xl font-display font-bold mb-8">Privacy Policy & Content Disclaimer</h1>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="text-lg text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">1. Platform Nature and BYOC Model</h2>
                        <p>FBupload Pro operates strictly as a Software-as-a-Service (SaaS) infrastructure provider. Our service utilizes a &quot;Bring Your Own Connection&quot; (BYOC) and &quot;Bring Your Own Content&quot; architecture. We provide the technological framework for content distribution; however, we do not curate, create, audit, or control the media assets, text, or data transmuted through our systems by Client Agencies.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">2. Zero Liability for User Content</h2>
                        <p>The Client Agency acknowledges and agrees that FBupload Pro acts solely as a passive conduit for the transmission of Agency-generated information. We explicitly disclaim any and all liability for the nature of the content posted, shared, or disseminated via our automation tools. This includes, but is not limited to:</p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li><strong>Copyright Infringement:</strong> Any unauthorized use of copyrighted material is the sole responsibility of the Client Agency.</li>
                            <li><strong>Inauthentic Behavior:</strong> We are not responsible for flags, bans, or penalties issued by third-party platforms (e.g., Facebook, Instagram) resulting from the Client Agency&apos;s distribution strategies.</li>
                            <li><strong>Illegal Content:</strong> The posting of any content deemed illegal, illicit, defamatory, or violative of local / international laws is strictly prohibited and falls under the full legal culpability of the Client Agency.</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">3. Data Transmission</h2>
                        <p>While we employ encryption to secure the transport of your data, the integrity and legality of the payload remain the domain of the Client Agency. By using our services, you indemnify FBupload Pro against any legal claims arising from the specific data points or media files you choose to process through our infrastructure.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4">4. Third-Party Platform Compliance</h2>
                        <p>Users adhere to the terms of service of all connected third-party platforms. FBupload Pro is not an affiliate of Meta Platforms, Inc. or its subsidiaries. Any violation of Meta&apos;s policies via our tool is a direct breach of this agreement by the Client Agency.</p>
                    </section>
                </div>
            </div>
        </div>
    )
}
