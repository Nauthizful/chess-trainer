import type { Opening, OpeningCategory } from '../types';

function inferCategory(eco: string): OpeningCategory {
  const prefix = eco.charAt(0).toUpperCase();
  switch (prefix) {
    case 'A':
      return 'Flanc (A)';
    case 'B':
      return 'Semi-Ouverte (B)';
    case 'C':
      return 'Ouverte (C)';
    case 'D':
      return 'Fermée (D)';
    case 'E':
    default:
      return 'Indienne (E)';
  }
}

function parsePgnMoves(pgn: string): string[] {
  return pgn
    .replace(/\d+\.(\.\.)?/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

interface RawOpening {
  id: string;
  eco: string;
  name: string;
  pgn: string;
  description: string;
}

const RAW_OPENINGS: RawOpening[] = [
  // Volume A : Flancs & Débuts Irréguliers / Anglaise / Réti / Hollandaise / Benoni (A00 - A99)
  {
    id: 'a00-polish',
    eco: 'A00',
    name: 'Ouverture Polonaise (Orang-Outan)',
    pgn: '1. b4 e5 2. Bb2 Bxb4 3. Bxe5 Nf6 4. Nf3 O-O',
    description: 'Attaque de flanc agressive visant immédiatement le pion e5 et la diagonale a1-h8.',
  },
  {
    id: 'a00-larsen',
    eco: 'A01',
    name: 'Attaque Nimzowitsch-Larsen',
    pgn: '1. b3 e5 2. Bb2 Nc6 3. e3 Nf6 4. Bb5 Bd6',
    description: 'Fianchetto dame hypermoderne exerçant une pression à distance sur le centre.',
  },
  {
    id: 'a00-grob',
    eco: 'A00',
    name: 'Attaque Grob',
    pgn: '1. g4 d5 2. Bg2 Bxg4 3. c4 c6 4. cxd5 cxd5 5. Qb3',
    description: 'Gambit provocateur sur l’aile roi cherchant une pression immédiate sur b7 et d5.',
  },
  {
    id: 'a02-bird',
    eco: 'A02',
    name: 'Ouverture Bird',
    pgn: '1. f4 d5 2. Nf3 Nf6 3. e3 g6 4. b3 Bg7 5. Bb2',
    description: 'Contrôle direct de la case e5 avec des plans similaires à une Hollandaise inversée.',
  },
  {
    id: 'a03-bird-from',
    eco: 'A03',
    name: 'Ouverture Bird - Gambit From',
    pgn: '1. f4 e5 2. fxe5 d6 3. exd6 Bxd6 4. Nf3 g5',
    description: 'Contre-gambit tranchant des Noirs pour exploiter la faiblesse de la diagonale e1-h4.',
  },
  {
    id: 'a04-reti',
    eco: 'A04',
    name: 'Ouverture Réti - Système Classique',
    pgn: '1. Nf3 d5 2. g3 Nf6 3. Bg2 c6 4. O-O Bg4 5. d3',
    description: 'Approche flexible et hypermoderne retardant la poussée centrale des pions.',
  },
  {
    id: 'a07-kia',
    eco: 'A07',
    name: 'Attaque Est-Indienne (Système Barcza)',
    pgn: '1. Nf3 d5 2. g3 Nf6 3. Bg2 c6 4. O-O Bf5 5. d3 e6 6. Nbd2',
    description: 'Schéma universel solide préparant la poussée e2-e4 et une attaque à l’aile roi.',
  },
  {
    id: 'a09-reti-accepted',
    eco: 'A09',
    name: 'Ouverture Réti - Gambit Réti',
    pgn: '1. Nf3 d5 2. c4 dxc4 3. e3 Nf6 4. Bxc4 e6 5. O-O c5',
    description: 'Les Blancs attaquent le centre d5 par le flanc et récupèrent le pion avec jeu actif.',
  },
  {
    id: 'a10-english',
    eco: 'A10',
    name: 'Ouverture Anglaise - Ligne Générale',
    pgn: '1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5',
    description: 'Contrôle asymétrique de d5 menant à une Défense Sicilienne inversée avec un temps de plus.',
  },
  {
    id: 'a13-english-agincourt',
    eco: 'A13',
    name: 'Ouverture Anglaise - Défense Agincourt',
    pgn: '1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. g3 dxc4 5. Bg2',
    description: 'Transposition souple entre l’Anglaise et la Catalane.',
  },
  {
    id: 'a20-english-sicilian',
    eco: 'A20',
    name: 'Anglaise - Sicilienne Inversée (Dragon)',
    pgn: '1. c4 e5 2. Nc3 Nf6 3. g3 Bb4 4. Bg2 O-O 5. e4 Bxc3 6. bxc3',
    description: 'Lutte positionnelle autour des cases d5 et d4.',
  },
  {
    id: 'a30-english-symmetrical',
    eco: 'A30',
    name: 'Ouverture Anglaise Symétrique',
    pgn: '1. c4 c5 2. Nf3 Nf6 3. Nc3 Nc6 4. g3 g6 5. Bg2 Bg7 6. O-O O-O',
    description: 'Structure miroir riche en manœuvres stratégiques et ruptures centrales.',
  },
  {
    id: 'a40-englund',
    eco: 'A40',
    name: 'Gambit Englund',
    pgn: '1. d4 e5 2. dxe5 Nc6 3. Nf3 Qe7 4. Bf4 Qb4+ 5. Bd2 Qxb2',
    description: 'Gambit risqué des Noirs contre 1. d4 rempli de pièges tactiques.',
  },
  {
    id: 'a43-old-benoni',
    eco: 'A43',
    name: 'Défense Benoni Ancienne',
    pgn: '1. d4 c5 2. d5 e5 3. Nc3 d6 4. e4 Be7 5. Nf3 Nf6',
    description: 'Centre fermé offrant des ruptures sur les ailes par f5 et b5.',
  },
  {
    id: 'a45-trompowsky',
    eco: 'A45',
    name: 'Attaque Trompowsky',
    pgn: '1. d4 Nf6 2. Bg5 Ne4 3. Bf4 d5 4. e3 c5 5. Bd3 Nf6',
    description: 'Évite les grandes théories indiennes en menaçant de doubler les pions f.',
  },
  {
    id: 'a46-london-system',
    eco: 'A46',
    name: 'Système de Londres',
    pgn: '1. d4 Nf6 2. Nf3 e6 3. Bf4 d5 4. e3 c5 5. c3 Nc6 6. Nbd2',
    description: 'Système solide et très populaire formant une pyramide de pions c3-d4-e3.',
  },
  {
    id: 'a52-budapest',
    eco: 'A52',
    name: 'Gambit de Budapest',
    pgn: '1. d4 Nf6 2. c4 e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+',
    description: 'Contre-attaque dynamique des Noirs pour récupérer le pion avec un développement rapide.',
  },
  {
    id: 'a57-benko-gambit',
    eco: 'A57',
    name: 'Gambit Benko (Volga)',
    pgn: '1. d4 Nf6 2. c4 c5 3. d5 b5 4. cxb5 a6 5. bxa6 Bxa6 6. Nc3 d6',
    description: 'Sacrifice de pion positionnel à long terme sur les colonnes semi-ouvertes a et b.',
  },
  {
    id: 'a60-modern-benoni',
    eco: 'A60',
    name: 'Défense Benoni Moderne',
    pgn: '1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. e4 g6',
    description: 'Déséquilibre majeur dès l’ouverture avec majorité dame noire contre majorité centrale blanche.',
  },
  {
    id: 'a80-dutch-leningrad',
    eco: 'A80',
    name: 'Défense Hollandaise - Leningrad',
    pgn: '1. d4 f5 2. g3 Nf6 3. Bg2 g6 4. Nf3 Bg7 5. O-O O-O 6. c4 d6',
    description: 'Combinaison de f5 et du fianchetto g6-Fg7 pour préparer la poussée e5.',
  },
  {
    id: 'a85-dutch-stonewall',
    eco: 'A85',
    name: 'Défense Hollandaise - Mur de Pierre (Stonewall)',
    pgn: '1. d4 f5 2. c4 Nf6 3. Nc3 e6 4. Nf3 d5 5. e3 c6 6. Bd3 Bd6',
    description: 'Chaîne de pions c6-d5-e6-f5 verrouillant la case e4 pour lancer une attaque à l’aile roi.',
  },

  // Volume B : Défenses Semi-Ouvertes (Sicilienne, Caro-Kann, Scandinave, Alekhine, Pirc) (B00 - B99)
  {
    id: 'b00-nimzowitsch',
    eco: 'B00',
    name: 'Défense Nimzowitsch',
    pgn: '1. e4 Nc6 2. d4 d5 3. Nc3 dxe4 4. d5 Ne5 5. Qd4 Ng6',
    description: 'Défense originale provoquant l’avance des pions centraux blancs pour mieux les miner.',
  },
  {
    id: 'b01-scandinavian',
    eco: 'B01',
    name: 'Défense Scandinave (Qa5)',
    pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bf5',
    description: 'Développement immédiat de la dame noire créant une structure solide type Caro-Kann.',
  },
  {
    id: 'b02-alekhine',
    eco: 'B02',
    name: 'Défense Alekhine',
    pgn: '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 Bg4 5. Be2 e6',
    description: 'Le cavalier attire les pions blancs vers l’avant afin de les fragiliser.',
  },
  {
    id: 'b06-modern',
    eco: 'B06',
    name: 'Défense Moderne',
    pgn: '1. e4 g6 2. d4 Bg7 3. Nc3 d6 4. f4 a6 5. Nf3 b5',
    description: 'Fianchetto roi flexible laissant le cavalier g8 libre tout en attaquant à l’aile dame.',
  },
  {
    id: 'b07-pirc-classical',
    eco: 'B07',
    name: 'Défense Pirc - Système Classique',
    pgn: '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Nf3 Bg7 5. Be2 O-O 6. O-O',
    description: 'Défense hypermoderne contre-attaquant le centre blanc depuis les ailes.',
  },
  {
    id: 'b09-pirc-austrian',
    eco: 'B09',
    name: 'Défense Pirc - Attaque Autrichienne',
    pgn: '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f4 Bg7 5. Nf3 O-O 6. Bd3',
    description: 'Réponse la plus agressive des Blancs contre la Pirc avec un centre massif d4-e4-f4.',
  },
  {
    id: 'b10-caro-two-knights',
    eco: 'B10',
    name: 'Caro-Kann - Attaque des Deux Cavaliers',
    pgn: '1. e4 c6 2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 5. Qxf3 e6',
    description: 'Les Blancs retardent d4 pour obtenir la paire de fous et un jeu de pièces rapide.',
  },
  {
    id: 'b12-caro-advance',
    eco: 'B12',
    name: 'Défense Caro-Kann - Variante d’Avance',
    pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. O-O',
    description: 'Le fou c8 sort avant e6, créant une bataille stratégique autour de la chaîne d4-e5.',
  },
  {
    id: 'b14-caro-panov',
    eco: 'B14',
    name: 'Défense Caro-Kann - Attaque Panov-Botvinnik',
    pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3',
    description: 'Jeu ouvert dynamique autour du pion dame isolé blanc sur d4.',
  },
  {
    id: 'b18-caro-classical',
    eco: 'B18',
    name: 'Défense Caro-Kann - Variante Classique',
    pgn: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6',
    description: 'Ligne principale solide où les Noirs consolident leur fou en g6 et visent e6 et Cd7.',
  },
  {
    id: 'b21-sicilian-morra',
    eco: 'B21',
    name: 'Sicilienne - Gambit Smith-Morra',
    pgn: '1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4',
    description: 'Gambit offensif des Blancs offrant un pion pour les colonnes c et d ouvertes.',
  },
  {
    id: 'b22-sicilian-alapin',
    eco: 'B22',
    name: 'Sicilienne - Variante Alapine (2. c3)',
    pgn: '1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 6. cxd4',
    description: 'Système anti-Sicilienne très fiable visant à établir un duo central d4-e4.',
  },
  {
    id: 'b23-sicilian-closed',
    eco: 'B23',
    name: 'Sicilienne Fermée',
    pgn: '1. e4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. d3 d6 6. f4',
    description: 'Approche positionnelle visant une attaque lente à l’aile roi par f4-f5.',
  },
  {
    id: 'b30-sicilian-rossolimo',
    eco: 'B30',
    name: 'Sicilienne - Variante Rossolimo',
    pgn: '1. e4 c5 2. Nf3 Nc6 3. Bb5 g6 4. Bxc6 dxc6 5. d3 Bg7 6. h3',
    description: 'Les Blancs évitent la Sicilienne ouverte et infligent des pions doublés sur la colonne c.',
  },
  {
    id: 'b33-sicilian-sveshnikov',
    eco: 'B33',
    name: 'Sicilienne - Variante Sveshnikov',
    pgn: '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6 7. Bg5 a6',
    description: 'Les Noirs acceptent un trou en d5 et un pion arriéré d6 en échange d’une grande activité.',
  },
  {
    id: 'b40-sicilian-kan',
    eco: 'B40',
    name: 'Sicilienne - Variante Kan (Paulsen)',
    pgn: '1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Bd3 Nf6 6. O-O Qc7',
    description: 'Structure hérisson flexible empêchant toute percée rapide des Blancs.',
  },
  {
    id: 'b70-sicilian-dragon',
    eco: 'B70',
    name: 'Sicilienne - Variante du Dragon',
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O',
    description: 'Le redoutable fou dragon en g7 balaie la grande diagonale face aux roques opposés.',
  },
  {
    id: 'b90-sicilian-najdorf',
    eco: 'B90',
    name: 'Sicilienne - Variante Najdorf',
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6',
    description: 'La Rolls-Royce des ouvertures de combat, riche en déséquilibres tactiques.',
  },

  // Volume C : Débuts Ouverts (1. e4 e5) & Défense Française (C00 - C99)
  {
    id: 'c02-french-advance',
    eco: 'C02',
    name: 'Défense Française - Variante d’Avance',
    pgn: '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3',
    description: 'Lutte intense contre la base d4 de la chaîne de pions blanche.',
  },
  {
    id: 'c03-french-tarrasch',
    eco: 'C03',
    name: 'Défense Française - Variante Tarrasch',
    pgn: '1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6',
    description: 'Évite le clouage Fb4 tout en maintenant la possibilité de soutenir d4 par c3.',
  },
  {
    id: 'c11-french-classical',
    eco: 'C11',
    name: 'Défense Française - Variante Classique',
    pgn: '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7',
    description: 'Développement naturel des pièces avant la contre-attaque sur le centre par c5 et f6.',
  },
  {
    id: 'c18-french-winawer',
    eco: 'C18',
    name: 'Défense Française - Variante Winawer',
    pgn: '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7',
    description: 'Les Noirs abîment la structure dame blanche au prix de la paire de fous et des cases noires.',
  },
  {
    id: 'c21-center-game',
    eco: 'C21',
    name: 'Gambit du Centre / Partie du Centre',
    pgn: '1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 5. Nc3 Bb4',
    description: 'Ouverture directe visant le grand roque rapide et une attaque sur les deux ailes.',
  },
  {
    id: 'c25-vienna',
    eco: 'C25',
    name: 'Partie Viennoise - Gambit Viennois',
    pgn: '1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7',
    description: 'Gambit du Roi retardé évitant les lignes les plus tranchantes avec Dh4+.',
  },
  {
    id: 'c30-kings-gambit',
    eco: 'C30',
    name: 'Gambit du Roi',
    pgn: '1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6',
    description: 'Classique romantique sacrifiant le pion f pour ouvrir la colonne f et dominer le centre.',
  },
  {
    id: 'c41-philidor',
    eco: 'C41',
    name: 'Défense Philidor',
    pgn: '1. e4 e5 2. Nf3 d6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Be7 6. Be2 O-O',
    description: 'Défense compacte et solide acceptant un léger déficit d’espace sans faiblesses.',
  },
  {
    id: 'c42-petroff',
    eco: 'C42',
    name: 'Défense Petroff (Défense Russe)',
    pgn: '1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Nc6',
    description: 'Réplique symétrique extrêmement solide prisée au plus haut niveau pour égaliser.',
  },
  {
    id: 'c44-scotch',
    eco: 'C44',
    name: 'Partie Écossaise',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5 5. Be3 Qf6 6. c3 Nge7',
    description: 'Ouverture immédiate du centre offrant un jeu de pièces libre et tactique.',
  },
  {
    id: 'c50-italian-giuoco-piano',
    eco: 'C50',
    name: 'Ouverture Italienne - Giuoco Piano',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+',
    description: 'Pression sur le point sensible f7 et construction rapide d’un centre idéal c3-d4.',
  },
  {
    id: 'c51-evans-gambit',
    eco: 'C51',
    name: 'Ouverture Italienne - Gambit Evans',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4',
    description: 'Sacrifice du pion b4 pour gagner un tempo sur le fou c5 et conquérir le centre.',
  },
  {
    id: 'c55-two-knights',
    eco: 'C55',
    name: 'Défense des Deux Cavaliers (Fried Liver / Polerio)',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6',
    description: 'Contre-attaque active des Noirs sacrifiant un pion pour prendre l’initiative.',
  },
  {
    id: 'c65-ruy-berlin',
    eco: 'C65',
    name: 'Partie Espagnole - Défense Berlinoise',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5',
    description: 'Le célèbre « Mur de Berlin », réputé presque infranchissable même en finales sans dames.',
  },
  {
    id: 'c89-ruy-marshall',
    eco: 'C89',
    name: 'Partie Espagnole - Attaque Marshall',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5',
    description: 'Gambit de contre-attaque dynamique des Noirs sur le roque blanc après c3.',
  },

  // Volume D : Débuts Fermés (Gambit Dame, Slave, Grünfeld, Systèmes d4 d5) (D00 - D99)
  {
    id: 'd02-colle',
    eco: 'D02',
    name: 'Système Colle',
    pgn: '1. d4 d5 2. Nf3 Nf6 3. e3 e6 4. Bd3 c5 5. c3 Nc6 6. Nbd2 Bd6',
    description: 'Schéma harmonieux préparant la poussée e3-e4 et l’attaque sur le roque.',
  },
  {
    id: 'd06-qgd-symmetrical',
    eco: 'D06',
    name: 'Gambit Dame - Défense Symétrique (Autrichienne)',
    pgn: '1. d4 d5 2. c4 c5 3. cxd5 Qxd5 4. Nf3 cxd4 5. Nc3 Qa5 6. Nxd4',
    description: 'Contre-attaque immédiate sur le centre avec c5 dès le deuxième coup.',
  },
  {
    id: 'd08-albin-countergambit',
    eco: 'D08',
    name: 'Contre-Gambit Albin',
    pgn: '1. d4 d5 2. c4 e5 3. dxe5 d4 4. Nf3 Nc6 5. g3 Be6 6. Nbd2',
    description: 'Le pion d4 crée un coin gênant dans le camp blanc et limite le développement.',
  },
  {
    id: 'd10-slav',
    eco: 'D10',
    name: 'Défense Slave - Ligne Principale',
    pgn: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6',
    description: 'Soutien de d5 tout en gardant la diagonale du fou c8 ouverte vers f5.',
  },
  {
    id: 'd20-qga',
    eco: 'D20',
    name: 'Gambit Dame Accepté (QGA)',
    pgn: '1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6',
    description: 'Les Noirs rendent le pion pour attaquer rapidement le centre blanc par c5 et a6-b5.',
  },
  {
    id: 'd35-qgd-exchange',
    eco: 'D35',
    name: 'Gambit Dame Refusé - Variante d’Échange',
    pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 Be7 6. e3 c6 7. Bd3',
    description: 'Structure Carlsbad offrant aux Blancs l’attaque de minorité à l’aile dame (b4-b5).',
  },
  {
    id: 'd45-semi-slav',
    eco: 'D45',
    name: 'Défense Semi-Slave',
    pgn: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Qc2 Bd6',
    description: 'Combinaison ultra-solide des défenses Slave et Orthodoxe préparant e5 ou dxc4.',
  },
  {
    id: 'd85-grunfeld-exchange',
    eco: 'D85',
    name: 'Défense Grünfeld - Variante d’Échange',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Bc4 c5',
    description: 'Les Noirs cèdent le centre aux Blancs pour mieux le bombarder avec c5 et Fg7.',
  },

  // Volume E : Débuts Indiens (Catalane, Nimzo-Indienne, Ouest-Indienne, Est-Indienne) (E00 - E99)
  {
    id: 'e00-catalan',
    eco: 'E00',
    name: 'Ouverture Catalane',
    pgn: '1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. Nf3 O-O 6. O-O dxc4',
    description: 'Pression positionnelle durable sur la grande diagonale h1-a8.',
  },
  {
    id: 'e12-queens-indian',
    eco: 'E12',
    name: 'Défense Ouest-Indienne (Petrosian)',
    pgn: '1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. a3 Bb7 5. Nc3 d5 6. cxd5 Nxd5',
    description: 'Contrôle des cases centrales e4 et d5 par le fianchetto dame Fb7.',
  },
  {
    id: 'e15-queens-indian-fianchetto',
    eco: 'E15',
    name: 'Défense Ouest-Indienne - Fianchetto',
    pgn: '1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Ba6 5. b3 Bb4+ 6. Bd2 Be7',
    description: 'Manœuvre moderne Fa6 attaquant le pion c4 vulnérable après g3.',
  },
  {
    id: 'e20-nimzo-indian',
    eco: 'E20',
    name: 'Défense Nimzo-Indienne - Système Rubinstein',
    pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5',
    description: 'Clouage du cavalier c3 empêchant e4 et visant un contrôle strict des cases noires.',
  },
  {
    id: 'e32-nimzo-classical',
    eco: 'E32',
    name: 'Défense Nimzo-Indienne - Variante Classique (4. Qc2)',
    pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O 5. a3 Bxc3+ 6. Qxc3 b6',
    description: 'Évite les pions doublés sur la colonne c pour conserver la paire de fous intacte.',
  },
  {
    id: 'e60-kings-indian-fianchetto',
    eco: 'E60',
    name: 'Défense Est-Indienne - Variante Fianchetto',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. Nf3 d6 5. g3 O-O 6. Bg2 Nbd7',
    description: 'Approche calme et positionnelle neutralisant les attaques à l’aile roi.',
  },
  {
    id: 'e97-kings-indian-mar-del-plata',
    eco: 'E97',
    name: 'Défense Est-Indienne - Mar del Plata',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7',
    description: 'Course à l’attaque explosive : les Blancs percent à l’aile dame (c5), les Noirs à l’aile roi (f5).',
  },
];

export const OPENINGS: Opening[] = RAW_OPENINGS.map((item) => ({
  ...item,
  moves: parsePgnMoves(item.pgn),
  category: inferCategory(item.eco),
}));
