# Legal text to update on the SwipePages landing page

The app and the landing page are separate sites:

| | Host | Legal pages |
| --- | --- | --- |
| App | Netlify (`ao3skingen.netlify.app`) | Updated and live — nothing to do |
| Landing page | SwipePages (`ao3skingen.wordfokus.com`) | **Still says Cloudinary — needs this** |

The landing page links to `/privacy-policy` and `/terms-of-service` (no `.html`).
Those are the copies people actually read, and they name Cloudinary as the image
processor. Uploads have gone to ImgBB for some time, so the statement is not
just stale — it names the wrong company as a data processor.

Everything below is the exact wording now live on the app. Find the old text in
the SwipePages editor and replace it.

---

## Privacy policy

**1. The TL;DR box**

> Your work stays on your device. We don't collect, store, or sell your creative content. We use Google Analytics to understand how people use the tool (anonymously), and we use ImgBB for image hosting when you upload an image or export your work. That's it.

**2. "Images You Upload" (section 2.1)**

> **Images You Upload:** If you choose to upload an image, or use "Copy for AO3" (which needs a public link to the finished picture), the image is sent to ImgBB, a third-party image hosting service. Images hosted there are publicly accessible to anyone with the link. We do not store these images on our servers.

**3. NEW paragraph — add directly after the one above**

This one is genuinely new, not a rename. The export now fetches pasted image
addresses server-side, and that is a data flow worth disclosing.

> **Image Addresses You Paste:** When you export, any image address you have pasted is fetched by our server so the picture can be embedded directly in the exported file. The address and the image pass through our server at that moment; neither is stored afterwards.

**4. "How We Use Information" bullet (section 3)**

> **Provide the service:** Image hosting via ImgBB enables uploads and the "Copy for AO3" export

**5. Third-party services (section 4.2)**

> **ImgBB:** Uploaded images and exported pictures are stored on ImgBB's servers. They are publicly accessible via URL. ImgBB's privacy policy applies to these uploads: https://imgbb.com/privacy

Link target changes from `https://cloudinary.com/privacy` to
`https://imgbb.com/privacy`.

**6. International transfers bullet (section 8)**

> ImgBB image uploads may be stored on servers in various regions

**7. Last updated** → `August 6, 2026`

---

## Terms of service

**1. Description of service (section 2)**

> Optional image upload via third-party service (ImgBB)

**2. Third-party services (section 6)**

> **ImgBB:** For image hosting. Subject to ImgBB's Terms of Service.

Link target changes from `https://cloudinary.com/tos` to `https://imgbb.com/tos`.

**3. DMCA note**

> **Note:** Since the Service creates CSS/HTML, not hosts user content, DMCA claims are rare. If you uploaded an infringing image to ImgBB, that falls under ImgBB's DMCA process.

**4. Last updated** → `August 6, 2026`

---

## Check when you're done

Neither page should return anything for a case-insensitive search for
"cloudinary". Both should mention ImgBB.

```bash
curl -s https://ao3skingen.wordfokus.com/privacy-policy | grep -ci cloudinary    # want 0
curl -s https://ao3skingen.wordfokus.com/terms-of-service | grep -ci cloudinary  # want 0
```

Note: SwipePages sits behind BunnyCDN, which caches. If the old text persists
after publishing, purge the CDN cache before concluding the edit didn't take.
