import {
  Button,
  Container,
  Navbar,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import "./styles.css";

const Header = ({ signOut }) => {
  
  return (
    <Navbar bg="dark" variant="dark" style={{ height: 100 }}>
      <Container>
        <Navbar.Brand>
          <Link to="/">Air Quality Predictor</Link>
        </Navbar.Brand>
        <Button color="inherit" onClick={signOut}>
          Sign out
        </Button>
      </Container>
    </Navbar>
  );
};

export default Header;
