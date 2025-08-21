-- Insert sample meals for testing and development
INSERT INTO meals (title, description, prep_time, steps, ingredients, tags) VALUES 
(
    'Spaghetti Carbonara',
    'Classic Italian pasta dish with eggs, cheese, and pancetta',
    30,
    ARRAY[
        'Cook spaghetti according to package directions',
        'Fry pancetta until crispy',
        'Beat eggs with cheese and black pepper',
        'Toss hot pasta with pancetta and egg mixture',
        'Serve immediately with extra cheese'
    ],
    ARRAY[
        '400g spaghetti',
        '200g pancetta',
        '4 large eggs',
        '100g Parmesan cheese',
        'Black pepper',
        'Salt'
    ],
    ARRAY['italian', 'pasta', 'quick']
),
(
    'Chicken Stir Fry',
    'Quick and healthy stir fry with vegetables and chicken',
    20,
    ARRAY[
        'Cut chicken into strips',
        'Heat oil in wok or large pan',
        'Cook chicken until golden',
        'Add vegetables and stir fry for 3-4 minutes',
        'Add sauce and cook for 2 more minutes'
    ],
    ARRAY[
        '500g chicken breast',
        '1 bell pepper',
        '1 broccoli head',
        '2 carrots',
        '3 tbsp soy sauce',
        '2 tbsp vegetable oil',
        '2 cloves garlic',
        '1 tsp ginger'
    ],
    ARRAY['asian', 'healthy', 'quick', 'gluten-free']
),
(
    'Vegetarian Chili',
    'Hearty plant-based chili with beans and vegetables',
    45,
    ARRAY[
        'Sauté onions and garlic until soft',
        'Add peppers and cook for 5 minutes',
        'Add tomatoes, beans, and spices',
        'Simmer for 30 minutes',
        'Taste and adjust seasoning'
    ],
    ARRAY[
        '2 cans kidney beans',
        '1 can black beans',
        '1 can diced tomatoes',
        '1 onion',
        '2 bell peppers',
        '3 cloves garlic',
        '2 tsp cumin',
        '1 tsp paprika',
        '1 tsp chili powder'
    ],
    ARRAY['vegetarian', 'healthy', 'comfort', 'gluten-free']
),
(
    'Salmon Teriyaki',
    'Glazed salmon with teriyaki sauce and steamed vegetables',
    25,
    ARRAY[
        'Marinate salmon in teriyaki sauce for 15 minutes',
        'Heat pan with a little oil',
        'Cook salmon skin-side down for 4 minutes',
        'Flip and cook for 3 more minutes',
        'Steam vegetables while salmon cooks',
        'Serve with rice'
    ],
    ARRAY[
        '4 salmon fillets',
        '4 tbsp teriyaki sauce',
        '2 cups broccoli',
        '1 cup snap peas',
        '2 cups jasmine rice',
        '1 tbsp vegetable oil',
        '1 tsp sesame seeds'
    ],
    ARRAY['fish', 'healthy', 'asian', 'gluten-free']
),
(
    'Margherita Pizza',
    'Classic Italian pizza with tomato, mozzarella, and basil',
    60,
    ARRAY[
        'Prepare pizza dough (or use store-bought)',
        'Roll out dough on floured surface',
        'Spread tomato sauce evenly',
        'Add sliced mozzarella',
        'Bake at 475°F for 12-15 minutes',
        'Top with fresh basil leaves'
    ],
    ARRAY[
        '1 pizza dough',
        '1/2 cup tomato sauce',
        '200g fresh mozzarella',
        'Fresh basil leaves',
        '2 tbsp olive oil',
        'Salt and pepper'
    ],
    ARRAY['italian', 'pizza', 'vegetarian', 'comfort']
);

-- Sample dietary restriction options for reference
-- Common dietary restrictions: 'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb', 'keto'