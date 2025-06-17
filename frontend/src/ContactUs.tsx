import React from "react";

export default function ContactUs() {
  const mail = "namemine153+contactus@gmail.com";
  const subject = encodeURIComponent("Contact Us Inquiry");
  const body = encodeURIComponent("Please describe your issue here.");
  const href = `mailto:${mail}?subject=${subject}&body=${body}`;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Contact Us</h1>
      <p>
        You can reach us at{' '}
        <a href={href} className="text-blue-500 underline">{mail}</a>.
      </p>
    </div>
  );
}
