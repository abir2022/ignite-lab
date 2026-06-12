import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-surface-container-lowest w-full py-gutter border-t border-outline-variant mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-margin-desktop max-w-container-max mx-auto gap-gutter">
        
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <span className="font-headline-md text-headline-md text-primary font-bold">DrilLab</span>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-base">
            © 2024 DrilLab Virtual Systems. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-gutter">
          <Link to="#" className="text-on-surface-variant font-body-md hover:text-secondary transition-colors">Privacy Policy</Link>
          <Link to="#" className="text-on-surface-variant font-body-md hover:text-secondary transition-colors">Terms of Service</Link>
          <Link to="#" className="text-on-surface-variant font-body-md hover:text-secondary transition-colors">API Docs</Link>
          <Link to="#" className="text-on-surface-variant font-body-md hover:text-secondary transition-colors">Help Center</Link>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
