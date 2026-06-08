export const Footer = () => {
  return (
    <footer className="bg-black/45 text-black px-6 py-20 min-h-screen">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="space-y-6">
          <div className="text-2xl font-bold text-white">Guerilla Glass.</div>
          <p className="text-white max-w-xs text-pretty">
            Record, edit, review, and deliver clearer product videos from one desktop workflow.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-white/70">
            Start with the open-source macOS app for local work. Move to a paid plan when your team
            needs review links, comments, and collaboration.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-16">
          <div className="space-y-4">
            <div className="font-bold text-sm uppercase tracking-widest text-white">Product</div>
            <div className="flex flex-col gap-2 text-sm text-white">
              <a href="#product" className="hover:text-white/70">
                How it works
              </a>
              <a href="#pricing" className="hover:text-white/70">
                Pricing
              </a>
              <a href="#faq" className="hover:text-white/70">
                FAQ
              </a>
            </div>
          </div>
          <div className="space-y-4">
            <div className="font-bold text-sm uppercase tracking-widest text-white">
              Get started
            </div>
            <div className="flex flex-col gap-2 text-sm text-white">
              <a
                href="https://github.com/okikeSolutions/guerillaglass"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white/70"
              >
                Download app
              </a>
              <a href="#pricing" className="hover:text-white/70">
                Buy a plan
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white text-xs text-white flex justify-between">
        <span>&copy; 2026 Guerilla Glass. All rights reserved.</span>
        <span>Local-first capture. Paid collaboration when you need it.</span>
      </div>
    </footer>
  );
};
