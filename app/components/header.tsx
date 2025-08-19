export default function Header() {
  return (
    <header
      className="bg-[#891F1A] text-white text-sm font-bold px-4 sm:px-6 lg:px-24 py-3 flex flex-nowrap justify-between items-center gap-2 sm:gap-4 md:flex"
      role="banner"
    >
      {/* Contact Info */}
      <div className="flex gap-2 sm:gap-4 items-center">
        <div className="flex gap-2 items-center">
          <img
            src="https://img.icons8.com/?size=100&id=9729&format=png&color=FFFFFF"
            alt="Phone Icon"
            width={20}
            height={20}
            loading="lazy"
            
            className="hidden lg:block w-5 h-5"
            
          />
          <span>+971-123-456-789</span>
        </div>
        <div className="w-1 h-4 bg-white hidden sm:block" aria-hidden="true" />
        <div className="flex gap-2 items-center">
          <img
            src="https://img.icons8.com/?size=100&id=12623&format=png&color=FFFFFF"
            alt="Email Icon"
            width={20}
            height={20}
            loading="lazy"
            
            className="hidden lg:block w-5 h-5"
            
          />
          <span>hi@printshop.com</span>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="flex gap-2 items-center mt-2 sm:mt-0">
        <span className="hidden lg:block">Bulk order and Get Free Shipping</span>
        <img
          src="https://img.icons8.com/?size=100&id=GLnivQZXkbdA&format=png&color=FFFFFF"
          alt="Shipping Icon"
          width={20}
          height={20}
          loading="lazy"
          
          className="w-5 h-5"
          
        />
      </div>
    </header>
  );
}
