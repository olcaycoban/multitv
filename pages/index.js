import Screen from '../components/Screen';

export default function Home() {
  return (
    <Screen
      screen="main"
      topbarClass="topbar--main"
      subtitle="Çoklu TV İzleme"
      accentColor="#c61d23"
      navHref="/bolge"
      navLabel="🌐 Bölge Ekranı"
    />
  );
}
