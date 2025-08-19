'use client';

export default function TestimonialsTablePage() {
  const data = [
    {
      name: 'John Doe',
      role: 'CEO, TechCorp',
      date: '2025-07-22',
      status: 'Published',
    },
    {
      name: 'Alice Smith',
      role: 'Marketing Lead',
      date: '2025-07-20',
      status: 'Draft',
    },
  ];

  return (
    <div className="p-4 border border-gray-200 bg-white rounded-xl shadow mt-6">
      <h2 className="text-xl font-semibold mb-4 text-[#891F1A]">Uploaded Testimonials</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Designation</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {data.map((item, idx) => (
              <tr className="border-t" key={idx}>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2">{item.role}</td>
                <td className="px-4 py-2">{item.date}</td>
                <td
                  className={`px-4 py-2 ${
                    item.status === 'Published' ? 'text-green-600' : 'text-yellow-600'
                  }`}
                >
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
