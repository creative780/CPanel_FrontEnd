'use client';
import { useState } from 'react';
import { Bell, UserPlus, Cake, Info } from 'lucide-react';
import Image from 'next/image';

const sampleNotifications = {
  new: [
    {
      type: 'friend_request',
      name: 'Rahul Verma',
      time: '3 days ago',
      mutual: 15,
      image: '/images/user1.jpg',
    },
  ],
  earlier: [
    {
      type: 'birthday_today',
      name: 'Tina Sharma',
      time: '4 hours ago',
      image: '/images/user2.jpg',
    },
    {
      type: 'birthday_yesterday',
      name: 'Ashwin Biyani and 2 others',
      time: 'a day ago',
      image: '/images/user3.jpg',
    },
    {
      type: 'birthday_past',
      name: 'Priyanka Soni and Sonal',
      time: '2 days ago',
      image: '/images/user4.jpg',
    },
    {
      type: 'group_post',
      name: 'Amit Tanwar',
      group: 'Flat and Flatmates (Gurgaon)',
      post: '2 bhk full...',
      time: '4 days ago',
      image: '/images/user5.jpg',
    },
    {
      type: 'page_update',
      page: 'jokersgallery.com',
      newName: 'Twenty20 Party Kerala',
      time: '2 weeks ago',
      image: '/images/page.jpg',
    },
    {
      type: 'friend_request',
      name: 'Mohan Yadav',
      time: '2 weeks ago',
      mutual: 10,
      image: '/images/user6.jpg',
    },
  ],
};

const NotificationItem = ({ notification }: { notification: any }) => {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-200">
      <div className="relative w-10 h-10 rounded-full overflow-hidden">
        <Image
          src={notification.image}
          alt="profile"
          width={40}
          height={40}
          className="rounded-full object-cover"
        />
        {notification.type === 'friend_request' && (
          <div className="absolute bottom-0 right-0 bg-[#891F1A] text-white rounded-full p-1">
            <UserPlus size={12} />
          </div>
        )}
        {notification.type.includes('birthday') && (
          <div className="absolute bottom-0 right-0 bg-pink-500 text-white rounded-full p-1">
            <Cake size={12} />
          </div>
        )}
        {notification.type === 'page_update' && (
          <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-1">
            <Info size={12} />
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-800">
          {notification.type === 'friend_request' && (
            <>
              <span className="font-semibold">{notification.name}</span> sent you a friend request.
              <div className="text-sm text-gray-500 mt-1">{notification.mutual} mutual friends</div>
              <div className="mt-2 flex gap-2">
                <button className="bg-[#891F1A] text-white text-sm px-3 py-1 rounded hover:bg-[#a14d4d]">Confirm</button>
                <button className="bg-gray-200 text-sm px-3 py-1 rounded hover:bg-gray-300">Delete</button>
              </div>
            </>
          )}
          {notification.type.includes('birthday') && (
            <>
              It’s <span className="font-semibold">{notification.name}</span>’s birthday. Help them celebrate!
            </>
          )}
          {notification.type === 'group_post' && (
            <>
              <span className="font-semibold">{notification.name}</span> posted in{' '}
              <span className="font-semibold">{notification.group}</span>: “{notification.post}”
            </>
          )}
          {notification.type === 'page_update' && (
            <>
              A page you like, <span className="font-semibold">{notification.page}</span>, changed its name to{' '}
              <span className="font-semibold">{notification.newName}</span>.
            </>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1">{notification.time}</div>
      </div>
      <div className="mt-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full" />
      </div>
    </div>
  );
};

const NotificationsPanel = () => {
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  return (
    <div className="w-[400px] max-w-full bg-white shadow-xl rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#891F1A]">Notifications</h2>
        <button className="text-sm text-blue-600 hover:underline">See all</button>
      </div>
      <div className="flex gap-4 mb-4">
        <button
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            tab === 'all' ? 'bg-[#891F1A] text-white' : 'text-[#891F1A] bg-gray-100'
          }`}
          onClick={() => setTab('all')}
        >
          All
        </button>
        <button
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            tab === 'unread' ? 'bg-[#891F1A] text-white' : 'text-[#891F1A] bg-gray-100'
          }`}
          onClick={() => setTab('unread')}
        >
          Unread
        </button>
      </div>

      {/* New Notifications */}
      <div>
        <h4 className="text-gray-500 text-xs font-semibold mb-1">New</h4>
        {sampleNotifications.new.map((n, i) => (
          <NotificationItem key={i} notification={n} />
        ))}
      </div>

      {/* Earlier Notifications */}
      <div className="mt-4">
        <h4 className="text-gray-500 text-xs font-semibold mb-1">Earlier</h4>
        {sampleNotifications.earlier.map((n, i) => (
          <NotificationItem key={i} notification={n} />
        ))}
      </div>
    </div>
  );
};

export default NotificationsPanel;
