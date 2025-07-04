import { ShelfTypography } from "~/components/icons/library";
import { config } from "~/config/shelf.config";
import { tw } from "~/utils/tw";
import When from "../when/when";

/**
 * Logo shown in the sidebar
 * If a custom logo is used, we dynamically show that or the symbol depending on {optimisticMinimizedSidebar}
 */
export const ShelfSidebarLogo = ({ minimized }: { minimized: boolean }) => {
  const { logoPath } = config;

  /** If a custom logo is used, we just use that instead of doing the dynamic Bizmap typograpy */
  if (logoPath) {
    return minimized ? (
      <img
        src={logoPath.symbol}
        alt="Bizmap Logo"
        className="mx-1.5 inline h-[50px] transition duration-150 ease-linear"
      />
    ) : (
      <img
        src={logoPath.fullLogo}
        alt="Bizmap Logo"
        className="mx-1.5 inline h-[50px] transition duration-150 ease-linear"
      />
    );
  }

  return (
    <>
      <img
        src="/static/images/shelf-symbol.png"
        alt="Bizmap Logo"
        className="mx-1.5 inline h-[32px]"
      />
      <When truthy={!minimized}>
        <span className="logo-text transition duration-150 ease-linear">
          <ShelfTypography />
        </span>
      </When>
    </>
  );
};

/**
 * Logo shown in the header for mobile screen sizes
 */
export const ShelfMobileLogo = () => {
  const { logoPath } = config;

  if (logoPath) {
    return <img src={logoPath.fullLogo} alt="Bizmap Logo" className="h-[46px]" />;
  }

  return (
    <img
      src="/static/images/logo-full-color(x2).png"
      alt="logo"
      className="h-[46px]"
    />
  );
};

/**
 * Lego symbol
 */
export const ShelfSymbolLogo = ({ className }: { className?: string }) => {
  const { logoPath } = config;
  const classes = tw("mx-auto mb-2 size-[70px]", className);

  if (logoPath) {
    return <img src={logoPath.symbol} alt="Bizmap Logo" className={classes} />;
  }

  return (
    <img src="/static/images/shelf-symbol.png" alt="logo" className={classes} />
  );
};

/**
 * Full logo
 */
export const ShelfFullLogo = ({ className }: { className?: string }) => {
  const { logoPath } = config;
  const classes = tw(className);

  if (logoPath) {
    return <img src={logoPath.fullLogo} alt="Bizmap Logo" className={classes} />;
  }

  return (
    <img
      src="/static/images/logo-full-color(x2).png"
      alt="logo"
      className={classes}
    />
  );
};
