"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({ invoicesPerPage, totalInvoices, paginate, currentPage }) => {
  const totalPages = Math.ceil(totalInvoices / invoicesPerPage);
  const maxPageNumbersToShow = 3;

  const startPage = Math.max(1, currentPage - Math.floor(maxPageNumbersToShow / 2));
  const endPage = Math.min(startPage + maxPageNumbersToShow - 1, totalPages);

  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
      {/* Mobile View */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => paginate(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => paginate(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Desktop View */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing{" "}
            <span className="font-medium">{(currentPage - 1) * invoicesPerPage + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(currentPage * invoicesPerPage, totalInvoices)}
            </span>{" "}
            of <span className="font-medium">{totalInvoices}</span> results
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {visiblePages.map((page) => (
            <button
              key={page}
              onClick={() => paginate(page)}
              className={`px-4 py-2 text-sm font-semibold rounded-md ${
                currentPage === page
                  ? "bg-black text-white"
                  : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
