import React from "react";

export default function ContactUs() {
  const telegram = "https://t.me/percy_ecomm_chat";
  const mail = "namemine153+contactus@gmail.com";
  const subject = encodeURIComponent("Contact Us Inquiry");
  const body = encodeURIComponent("Please describe your issue here.");
  const href = `mailto:${mail}?subject=${subject}&body=${body}`;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Contact Us</h1>
      <p>
        Join our Telegram group{' '}
        <a href={telegram} className="text-blue-500 underline">here</a>
        {' '}or email us at{' '}
        <a href={href} className="text-blue-500 underline">{mail}</a>.
      </p>
    </div>
  );
}
