import { GetServerSideProps } from 'next'

// Statistika was folded into the dashboard (redesign.md §5.1) so no number lives on two
// pages. The route is kept as a redirect: old bookmarks and links still work.
export default function StatsRedirect() { return null }

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/admin', permanent: false },
})
