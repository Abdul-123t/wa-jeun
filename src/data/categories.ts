import { FoodCategory } from '../types';

export const FOOD_CATEGORIES: FoodCategory[] = [
  {
    id: 'rice-dishes',
    name: 'Rice Dishes',
    description: 'Jollof rice, fried rice, Ofada rice, and delicious rice combinations.',
    image: '/src/assets/images/category_rice_dishes_1792169660991.jpg',
    popularItems: ['Jollof Rice & Dodo', 'Fried Rice with Chicken', 'Ofada Rice & Ayamase', 'Native Concoction Rice']
  },
  {
    id: 'swallow-soups',
    name: 'Swallow and Soups',
    description: 'Amala, eba, pounded yam, fufu, and traditional Nigerian soups.',
    image: '/src/assets/images/category_swallow_soups_1792169661810.jpg',
    popularItems: ['Amala with Ewedu & Gbegiri', 'Pounded Yam & Egusi', 'Eba with Efo Riro', 'Fufu & Ogbono Soup']
  },
  {
    id: 'buka-meals',
    name: 'Buka Meals',
    description: 'Familiar local meals, traditional stews, beans, and everyday Nigerian favorites.',
    image: '/src/assets/images/category_local_bukameals_1792169662615.jpg',
    popularItems: ['Ofada Rice with Ayamase', 'Ewa Agoyin & Fried Plantain', 'Assorted Meat Buka Stew', 'Catfish Pepper Soup']
  },
  {
    id: 'street-food',
    name: 'Street Food',
    description: 'Akara, boli, roasted corn, suya, roasted yam, and other street-side favorites.',
    image: '/src/assets/images/category_street_food_1792174171995.jpg',
    popularItems: ['Hot Golden Akara', 'Boli (Roasted Plantain) & Groundnuts', 'Roasted Sweet Corn', 'Street Suya & Roasted Yam']
  },
  {
    id: 'grills-shawarma',
    name: 'Grills and Shawarma',
    description: 'Grilled chicken, suya, shawarma wraps, kebabs, and grilled meat.',
    image: '/src/assets/images/category_grills_shawarma_1792169662635.jpg',
    popularItems: ['Beef Suya with Yaji', 'Peppered Grilled Chicken', 'Toasted Shawarma Wraps', 'Grilled Croaker Fish']
  },
  {
    id: 'fast-food',
    name: 'Fast Food',
    description: 'Burgers, crispy fried chicken, chips, stir-fried noodles, and other quick meals.',
    image: '/src/assets/images/category_fast_food_1792174171687.jpg',
    popularItems: ['Juicy Beef Burgers', 'Crispy Fried Chicken', 'Hot Golden Chips / Fries', 'Stir-fried Noodles']
  },
  {
    id: 'snacks-pastries',
    name: 'Snacks and Pastries',
    description: 'Meat pies, sausage rolls, puff-puff, scotch eggs, and freshly baked treats.',
    image: '/src/assets/images/category_snacks_pastries_1792174173242.jpg',
    popularItems: ['Flaky Meat Pies', 'Sausage Rolls', 'Sweet Round Puff-Puff', 'Scotch Eggs & Chin-Chin']
  },
  {
    id: 'drinks-beverages',
    name: 'Drinks and Beverages',
    description: 'Zobo, kunu, chilled juice, smoothies, malt drinks, and refreshing beverages.',
    image: '/src/assets/images/category_drinks_beverages_1792174172917.jpg',
    popularItems: ['Chilled Hibiscus Zobo', 'Creamy Fresh Kunu', 'Chilled Fruit Juices', 'Cold Bottled Malt']
  }
];

export const IJEBU_ODE_AREAS = [
  'Igbeba',
  'Molipa',
  'Folagbade',
  'Oke-Aje',
  'Obalende',
  'Bonojo',
  'Imowo',
  'Sabo',
  'Erinlu',
  'Degun',
  'GRA (Government Reserved Area)',
  'Ibadan Road',
  'Lagos Garage / Expressway',
  'Other Neighborhood in Ijebu Ode'
];
