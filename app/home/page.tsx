"use client"; // Ensures this component runs on the client side

import React, { useState } from "react";
// Removed unused import: import HorizontalScroll from '@/app/components/HorizontalScroll';

// Data structure for the navigation items, including dropdown content for "Gift Items".
const navItemsData = [
  { label: "Business Card", url: "#", dropdownContent: null },
  {
    label: "Gift Items",
    url: "#",
    dropdownContent: {
      title: "Gift Items",
      columns: [
        {
          items: [
            { label: "Mugs", url: "#", color: "red" },
            { label: "Pens", url: "#", color: "red" },
            { label: "Keychains", url: "#", color: "red" },
            { label: "USBs", url: "#", color: "red" },
          ]
        },
        {
          items: [
            { label: "Calendars", url: "#", color: "black" },
            { label: "Wallets", url: "#", color: "black" },
            { label: "Notebooks", url: "#", color: "black" },
            { label: "Cups", url: "#", color: "black" },
          ]
        },
      ]
    }
  },
  { label: "Stickers", url: "#", dropdownContent: null },
  { label: "Apparel", url: "#", dropdownContent: null },
  { label: "Signage", url: "#", dropdownContent: null },
  { label: "Flags", url: "#", dropdownContent: null },
  { label: "Backdrops & Exhibition", url: "#", dropdownContent: null },
  { label: "Flyers", url: "#", dropdownContent: null },
];

// Helper function to dynamically set the text color for dropdown items based on data.
const getDropdownItemColorClass = (color) => {
  switch (color) {
    case 'red':
      return 'text-red-600'; // Styling for red text.
    case 'black':
    default:
      return 'text-gray-800'; // Default styling for dark gray/black text.
  }
};

export default (props) => {
    // State to track which navigation item is currently being hovered over.
    const [hoveredIndex, setHoveredIndex] = useState(null);

    return (
        <div className="flex flex-col bg-white">
            {/* Top Header Section */}
            {/* This section remains the same as provided previously */}
            <div className="self-stretch">
                {/* Top Bar with contact info and promotions */}
                <div className="flex justify-between items-start self-stretch bg-[#891F1A] py-3 pl-[150px] pr-[162px]">
                    <div className="flex shrink-0 items-center">
                        <div className="flex shrink-0 items-center pr-[3px] mr-[21px] gap-3">
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/dwsfapk0_expires_30_days.png"}
                                className="w-5 h-5 object-fill"
                            />
                            <span className="text-white text-sm font-bold w-[116px]" >
                                {"+971-123-456-789"}
                            </span>
                        </div>
                        <div className="bg-white w-1.5 h-4 mr-[17px]">
                        </div>
                        <div className="flex shrink-0 items-center pr-[3px] gap-3">
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/qu1a0y8f_expires_30_days.png"}
                                className="w-5 h-5 object-fill"
                            />
                            <span className="text-white text-sm font-bold w-[118px]" >
                                {"hi@printshop.com"}
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center my-[1px] gap-[15px]">
                        <span className="text-white text-sm font-bold" >
                            {"Bulk order and Get Free Shipping"}
                        </span>
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/sg8tbt0e_expires_30_days.png"}
                            className="w-5 h-5 object-fill"
                        />
                    </div>
                </div>

                {/* Main Header Row with Logo, Search, and Utility Links */}
                <div className="flex items-center ml-[150px] py-4">
                    <img
                        src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/1hyiczb8_expires_30_days.png"}
                        className="w-[221px] h-[53px] mr-[68px] object-fill"
                    />
                    <div className="flex shrink-0 items-center bg-[#ECECEC] px-3.5 mr-[51px] rounded-md">
                        <span className="text-[#0E0E0E] text-sm font-bold mr-[278px]" >
                            {"What are you looking to print on?"}
                        </span>
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/anloohrj_expires_30_days.png"}
                            className="w-[1px] h-[43px] mr-[18px] object-fill"
                        />
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/jd730mnf_expires_30_days.png"}
                            className="w-5 h-5 object-fill"
                        />
                    </div>
                    <img
                        src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/cwe0dh5j_expires_30_days.png"}
                        className="w-5 h-5 mr-[9px] object-fill"
                    />
                    <span className="text-black text-base font-bold mr-[13px]" >
                        {"Help Centre"}
                    </span>
                    <img
                        src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/dpsmaw1b_expires_30_days.png"}
                        className="w-[21px] h-[21px] mr-[9px] object-fill"
                    />
                    <span className="text-black text-base font-bold" >
                        {"UAE"}
                    </span>
                </div>
            </div>

            {/* --- START OF UPDATED NAVBAR SECTION --- */}
            <div className="flex overflow-x-auto w-full px-4 md:w-[1057px] gap-4 md:gap-8 no-scrollbar py-2 bg-white border-b border-gray-200">
              {navItemsData.map((item, index) => (
                // The key wrapper div handles hover events and positioning.
                <div
                  key={index}
                  // Removed 'shrink-0' and 'flex items-center'. 'relative' is crucial.
                  className="relative"
                  onMouseEnter={() => {
                    console.log(`MouseEnter: Index ${index}, Current hoveredIndex: ${hoveredIndex}`); // Log hover start
                    setHoveredIndex(index);
                  }}
                  onMouseLeave={() => {
                    console.log(`MouseLeave: Index ${index}, Current hoveredIndex: ${hoveredIndex}`); // Log hover end
                    setHoveredIndex(null);
                  }}
                >
                  {/* The actual navigation link */}
                  <a
                    href={item.url}
                    // Added padding for a more robust hover target area.
                    // 'inline-block' makes padding and margin work correctly.
                    className="text-gray-800 text-sm md:text-base font-bold whitespace-nowrap hover:text-red-600 transition-colors duration-200 px-2 py-1 inline-block"
                  >
                    {item.label}
                  </a>

                  {/* Debugging log for condition check */}
                  {/* console.log(`Check condition for index ${index}: hoveredIndex=${hoveredIndex}, item.dropdownContent=${item.dropdownContent ? 'exists' : 'null'}`); */}

                  {/* Conditionally render the dropdown menu */}
                  {/* It appears only if the item has dropdown content AND the index matches the hoveredIndex */}
                  {item.dropdownContent && hoveredIndex === index && (
                    <div
                      // Styles for the dropdown container: absolute positioning below the link.
                      className="absolute top-full left-0 mt-2 w-max bg-white shadow-lg rounded-md p-4 border border-gray-200 z-10"
                      // Uncomment for visual debugging: add a border to see the dropdown's exact position and size.
                      // style={{ border: '1px solid blue', boxSizing: 'border-box' }}
                    >
                      {/* Title for the dropdown menu */}
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
                        {item.dropdownContent.title}
                      </h3>
                      <div className="flex gap-8">
                        {/* Render the columns of sub-items */}
                        {item.dropdownContent.columns.map((column, colIndex) => (
                          <div key={colIndex} className="flex flex-col gap-2">
                            {/* Render individual sub-item links */}
                            {column.items.map((subItem, subIndex) => (
                              <a
                                key={subIndex}
                                href={subItem.url}
                                className={`${getDropdownItemColorClass(subItem.color)} text-sm whitespace-nowrap hover:underline`}
                              >
                                {subItem.label}
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* --- END OF UPDATED NAVBAR SECTION --- */}

            {/* --- Rest of the page content (unchanged from previous version) --- */}
            <div className="flex flex-col self-stretch">
                <div className="self-stretch bg-black h-[1px]">
                </div>
                <img
                    src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ymeg8jht_expires_30_days.png"}
                    className="self-stretch h-[400px] object-fill"
                />
            </div>

            <div className="self-stretch">
                <div className="flex flex-col items-center bg-white py-7 px-4 md:px-0">
                    <span className="text-[#891F1A] text-[32px] font-bold text-center mb-2.5 mx-[287px]" >
                        {"Online Printing Service with Creative Xonnect."}
                    </span>
                    <span className="text-[#757575] text-xs text-center mb-[29px] mx-[375px]" >
                        {"From Business cards to banners, Hello prints offers a wide range of online printing & personalized print products to enhance your brands and marketing efforts, catering to all your professionals and personal printing need. Flyers, Bookups, Roller banners, Business Cards, folded leaflets etc"}
                    </span>
                    <div className="flex items-start self-stretch mb-[30px] mx-[150px] gap-[5px]">
                        <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                        <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                        <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                        <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                        <div className="flex flex-1 flex-col items-start relative">
                            <div className="self-stretch bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/r0ry8tsz_expires_30_days.png"}
                                className="w-10 h-10 absolute bottom-[54px] right-[-20px] object-fill"
                            />
                        </div>
                    </div>

                    <h2 className="text-[#891F1A] text-2xl md:text-[32px] font-bold mb-2.5 text-center w-full">
                      Why choose CreativePrint?
                    </h2>

                    <p className="text-[#757575] text-xs md:text-sm text-center mb-[30px] max-w-4xl mx-auto px-4">
                      From business cards to banners, HelloPrint offers a wide range of online printing & personalised print products to enhance your brand and marketing efforts, catering to all your professional and personal printing needs.
                      <br />
                      Flyers, Booklets, Rollup Banners, Posters, Business Cards, Folded Leaflets.
                    </p>

                    <div className="flex flex-col md:flex-row justify-center items-center gap-4 w-full max-w-6xl px-4 md:px-0">
                      <div className="w-full md:w-1/3 bg-[#891F1A4D] h-[183px] rounded-[10px] border border-solid border-black"></div>
                      <div className="w-full md:w-1/3 bg-[#891F1A4D] h-[183px] rounded-[10px] border border-solid border-black"></div>
                      <div className="w-full md:w-1/3 bg-[#891F1A4D] h-[183px] rounded-[10px] border border-solid border-black"></div>
                    </div>
                </div>

                <div className="self-stretch bg-[#D9D9D9] h-[250px]"></div>
            </div>

            <div className="flex flex-col self-stretch bg-white pt-[29px] pb-[47px]">
                <span className="text-[#891F1A] text-[32px] font-bold text-center mb-2.5 mx-[287px]" >
                    {"Boost Your Startup with best corporate items"}
                </span>
                <span className="text-[#757575] text-xs text-center mb-[29px] mx-[375px]" >
                    {"From business cards to banners, HelloPrint offers a wide range of online printing & personalised print products to enhance your brand and marketing efforts, catering to all your professional and personal printing needs.\nFlyers, Booklets, Rollup Banners, Posters, Business Cards, Folded Leaflets."}
                </span>
                <div className="flex items-start self-stretch mb-[30px] mx-[150px] gap-[5px]">
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex flex-1 flex-col items-start relative">
                        <div className="self-stretch bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/r0ry8tsz_expires_30_days.png"}
                            className="w-10 h-10 absolute bottom-[54px] right-[-20px] object-fill"
                        />
                    </div>
                </div>
                <span className="text-[#891F1A] text-[32px] font-bold text-center mb-[29px] mx-[287px]" >
                    {"Discover our categories"}
                </span>
                <div className="flex items-start self-stretch mb-[5px] mx-[150px]">
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-1.5 rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-[7px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-[7px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                </div>
                <div className="flex items-start self-stretch mb-[30px] mx-[150px]">
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-1.5 rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-[7px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] mr-[7px] rounded-[10px] border border-solid border-black"></div>
                    <div className="flex-1 bg-[#D9D9D9] h-[150px] rounded-[10px] border border-solid border-black"></div>
                </div>
                <span className="text-[#891F1A] text-[32px] font-bold text-center mb-[29px] mx-[287px]" >
                    {"What our happy customers say:"}
                </span>
                <div className="flex flex-col items-start self-stretch mx-[81px] gap-2.5">
                    <div className="flex items-center ml-5">
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/m7u4g6fl_expires_30_days.png"}
                            className="w-[74px] h-[74px] mr-3.5 object-fill"
                        />
                        <div className="flex flex-col shrink-0 items-start mr-[182px] gap-2">
                            <span className="text-black text-2xl font-bold m-11 mt-0 mb-0" >
                                {"Juan Mattew"}
                            </span>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/c5tmzh1q_expires_30_days.png"}
                                className="w-[120px] h-6 object-fill m-11 mb-0 mt-0"
                            />
                        </div>
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/5ugc7n27_expires_30_days.png"}
                            className="w-[74px] h-[74px] mr-[15px] object-fill"
                        />
                        <div className="flex flex-col shrink-0 items-start mr-[182px] gap-2">
                            <span className="text-black text-2xl font-bold m-15 mt-0 mb-0" >
                                {"Juan Mattew"}
                            </span>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/c5tmzh1q_expires_30_days.png"}
                                className="w-[120px] h-6 object-fill m-15 mb-0 mt-0"
                            />
                        </div>
                        <img
                            src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/1u25ycvk_expires_30_days.png"}
                            className="w-[74px] h-[74px] mr-[15px] object-fill"
                        />
                        <div className="flex flex-col shrink-0 items-start mr-[182px] gap-2">
                            <span className="text-black text-2xl font-bold m-11 mt-0 mb-0" >
                                {"Juan Mattew"}
                            </span>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/c5tmzh1q_expires_30_days.png"}
                                className="w-[120px] h-6 object-fill m-11 mb-0 mt-0"
                            />
                        </div>
                    </div>
                    <div className="flex items-start self-stretch mx-[21px]">
                        <div className="flex flex-1 flex-col items-start relative mr-3">
                            <div className="self-stretch bg-[#D9D9D9] h-[203px] rounded-[10px]"></div>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/6vsjzky1_expires_30_days.png"}
                                className="w-10 h-10 absolute bottom-20 left-[-20px] object-fill"
                            />
                        </div>
                        <div className="flex-1 bg-[#D9D9D9] h-[203px] mr-[15px] rounded-[10px]"></div>
                        <div className="flex flex-1 flex-col items-start relative">
                            <div className="self-stretch bg-[#D9D9D9] h-[203px] rounded-[10px]"></div>
                            <img
                                src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/ercjwey1_expires_30_days.png"}
                                className="w-10 h-10 absolute bottom-20 right-[-20px] object-fill"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-stretch bg-[#FFFFFF] py-0">
                <div className="flex flex-row w-full px-[80px] pt-[60px] pb-[40px]"
                    style={{
                        background: 'linear-gradient(to bottom, #ffffff 80%, #FFF4F0 20%)',
                        paddingTop: '3rem',
                        paddingBottom: '3rem'
                    }}>
                    <div className="flex flex-col flex-1 justify-center">
                        <span className="text-[#837E8C] text-base font-semibold mb-2">Call To Action</span>
                        <span className="text-[#0E0E0E] text-[44px] font-bold leading-tight mb-4">
                            Let’s Bring Your Ideas to Life
                        </span>
                        <span className="text-[#868686] text-base font-normal mb-8 max-w-[480px]">
                            Scelerisque in dolor donec neque velit. Risus aenean integer elementum odio sed adipiscing. Sem id scelerisque nunc quis. Imperdiet nascetur consequat.
                        </span>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <div className="w-[380px] h-[380px] bg-[#8B8491] rounded-xl" />
                    </div>
                </div>

                <div className="flex flex-row w-full px-[80px] pb-[40px] bg-[#FFF4F0]">
                    <div className="flex flex-col flex-1">
                        <span className="text-[#271E32] text-sm font-semibold mb-2">Contact Information :</span>
                        <div className="flex flex-row gap-[80px]">
                            <div>
                                <span className="block text-[#0E0E0E] text-base font-bold mb-1">Contact Us</span>
                                <span className="block text-[#271E32] text-base font-normal">+971-123-456-789</span>
                            </div>
                            <div>
                                <span className="block text-[#0E0E0E] text-base font-bold mb-1">Email Us</span>
                                <span className="block text-[#271E32] text-base font-normal">hi@printshop.com</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-start self-stretch bg-[#891F1A] pt-[110px] pb-16">
                <div className="flex items-center mb-[9px] ml-[150px]">
                    <img
                        src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/ZfQW3qI2ok/zxysrwwm_expires_30_days.png"}
                        className="w-[232px] h-14 mr-[148px] object-fill"
                    />
                    <div className="flex flex-col shrink-0 items-start gap-5">
                        <span className="text-white text-base font-bold mr-[33px]" >
                            {"Overview"}
                        </span>
                        <span className="text-white text-base font-bold" >
                            {"Features"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center mb-[9px] ml-[150px]">
                    <span className="text-white text-base font-bold w-[275px] mr-[105px]" >
                        {"Unlock Your Business's Potential with Our Social Media Solutions"}
                    </span>
                    <div className="flex flex-col shrink-0 items-center gap-[15px]">
                        <span className="text-white text-base font-bold" >
                            {"Pricing"}
                        </span>
                        <span className="text-white text-base font-bold" >
                            {"Careers"}
                        </span>
                    </div>
                </div>
                <span className="text-white text-base font-bold mb-[15px] ml-[530px]" >
                    {"Help"}
                </span>
                <span className="text-white text-base font-bold mb-[34px] ml-[530px]" >
                    {"Privacy"}
                </span>
                <div className="flex flex-col self-stretch mx-[150px] gap-[33px]">
                    <div className="self-stretch bg-[#837E8C] h-[1px]">
                    </div>
                    <div className="flex flex-col items-center self-stretch">
                        <span className="text-[#F3EFEE] text-base font-bold w-[275px]" >
                            {"© 2025 Printshop. All rights reserved."}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}