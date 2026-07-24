import { Link } from "react-router-dom";
import CoverageCarousel from "../components/CoverageCarousel";
import { COMPETITIONS } from "../competitions";

export default function HomePage() {
  return (
    <>
      <CoverageCarousel />

      <section className="home-competitions">
        <h2>Pick a competition</h2>
        <p>Open a tournament to view fixtures and predict final scores. Compete against your friends and earn points for correct predictions.</p>
        <div className="home-competitions__grid">
          {COMPETITIONS.map(competition => (
            <Link
              key={competition.code}
              to={competition.path}
              className="home-competitions__card">
              <strong>{competition.name}</strong>
              <span>{competition.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="spacer"></section>
    </>
  );
}
