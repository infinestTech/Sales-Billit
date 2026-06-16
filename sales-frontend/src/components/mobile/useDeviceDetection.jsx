function useDeviceDetection() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkDevice = () => {
      const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
      setIsMobile(mobileMediaQuery.matches);
    };

    // Check on initial load
    checkDevice();

    // Listen for window resize
    const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
    const handleMediaChange = (e) => {
      setIsMobile(e.matches);
    };

    mobileMediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mobileMediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  return { isMobile };
}

// Register globally for the in-browser JSX loader
window.useDeviceDetection = useDeviceDetection;
