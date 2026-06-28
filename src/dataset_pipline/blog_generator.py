import json
import os
import requests
import logging
from datetime import datetime, timezone
from db_manager import DatabaseManager
from config import MONGODB_URI, DB_NAME

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BlogGenerator")

class BlogGenerator:
    def __init__(self):
        self.db = DatabaseManager(MONGODB_URI, DB_NAME)
        self.stats_path = os.path.join(os.path.dirname(__file__), "latest_stats.json")

    def get_stats(self):
        """Read latest stats from JSON file."""
        try:
            with open(self.stats_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read stats: {e}")
            return None

    def generate_blog(self, stats, feedback=None):
        """Generate blog post using Ollama and llama3.2:1b."""
        if not stats:
            return None

        prompt = f"""
        You are an AI environmental scientist writing for GlacioWatch. 
        Write a professional, engaging, and premium blog post based on the following daily glacial monitoring stats:
        - Date: {stats['generated_at']}
        - Total Glaciers Monitored: {stats['summary']['total_glaciers']}
        - Total Area: {stats['summary']['total_area_km2']} km²
        - Largest Glacier: {stats['summary']['largest_glacier']}
        - Regions Covered: {', '.join(stats['by_region'].keys())}

        {"Feedback to incorporate: " + feedback if feedback else ""}

        The blog should highlight the importance of monitoring these glaciers and what the current data suggests about climate impact.
        Keep it concise (about 200 words), scientific yet accessible, and professional.
        The 'content' field should be a single string containing the full blog text with proper paragraphs.
        Format the output as a JSON object with 'title', 'content', and 'date' fields.
        DO NOT include any text outside the JSON object.
        """

        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:1b",
                    "prompt": prompt,
                    "stream": False
                }
            )
            response.raise_for_status()
            result = response.json()
            text = result['response'].strip()
            
            # Find the JSON part
            import re
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                blog_data = json.loads(json_match.group(0))
                return blog_data
            else:
                logger.error(f"No JSON found in response: {text}")
                return None
        except Exception as e:
            logger.error(f"Failed to generate blog: {e}")
            return None

    def store_blog(self, blog_data):
        """Store the generated blog in MongoDB."""
        if not blog_data or not self.db.is_connected():
            return False

        try:
            # Create a copy to avoid modifying the original data
            db_entry = blog_data.copy()
            db_entry['timestamp'] = datetime.now(timezone.utc)
            self.db.db["blogs"].insert_one(db_entry)
            logger.info("✅ Blog stored in database")
            return True
        except Exception as e:
            logger.error(f"Failed to store blog: {e}")
            return False

    def generate_gallery_items(self, glaciers):
        """Generate gallery items with descriptions using Ollama."""
        gallery_items = []
        for i, glacier in enumerate(glaciers[:6]):
            prompt = f"""
            Write a professional description and a technical snippet for this glacier:
            Name: {glacier.get('name', 'Unnamed Glacier')}
            Region: {glacier.get('region', 'Unknown')}
            Area: {glacier.get('area_km2', 'N/A')} km²
            
            Format:
            Description: [Your 1-2 sentence description here]
            Snippet: [Your 5-word technical info here]
            """
            
            try:
                response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "llama3.2:1b",
                        "prompt": prompt,
                        "stream": False
                    }
                )
                response.raise_for_status()
                text = response.json()['response'].strip()
                
                # Parse plain text response
                desc = ""
                info = ""
                
                for line in text.split('\n'):
                    line = line.strip()
                    if not line: continue
                    
                    if ':' in line:
                        key, val = line.split(':', 1)
                        if 'description' in key.lower():
                            desc = val.strip()
                        elif 'snippet' in key.lower() or 'info' in key.lower():
                            info = val.strip()
                
                # Fallback if parsing failed
                if not desc: desc = f"Advanced satellite imagery highlighting the unique features of {glacier.get('name', 'this glacier')}."
                if not info: info = "Sentinel-2 Multi-Spectral Data"

                item = {
                    "id": i + 1,
                    "title": glacier.get('name', 'Glacier Analysis'),
                    "category": "Satellite View",
                    "year": datetime.now().year,
                    "image": "/images/glacier-hero.png" if i % 2 == 0 else "/images/thermal-analysis.png",
                    "description": desc,
                    "info": info,
                    "location": glacier.get('region', 'Himalayan Range')
                }
                gallery_items.append(item)
                logger.info(f"✅ Generated gallery item for {item['title']}")
            except Exception as e:
                logger.error(f"Failed to generate gallery item {i}: {e}")
                
        return gallery_items

    def update_website_content(self, stats, blog_data, gallery_items):
        """Update the website's content.json file."""
        content_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "website", "lib", "content.json"))
        try:
            with open(content_path, "r") as f:
                content = json.load(f)
            
            # Update stats
            content['artist']['stats'] = {
                "totalGlaciers": stats['summary']['total_glaciers'],
                "totalArea": stats['summary']['total_area_km2'],
                "largest": stats['summary']['largest_glacier'],
                "states": stats['summary']['states_covered']
            }
            
            # Update blog
            content['blog'] = blog_data
            
            # Update gallery
            if gallery_items:
                content['gallery'] = gallery_items
            
            with open(content_path, "w") as f:
                json.dump(content, f, indent=2)
            
            logger.info("✅ Website content.json updated (Blog & Gallery)")
        except Exception as e:
            logger.error(f"Failed to update website content: {e}")

    def run(self, feedback=None):
        """Run the full generation and storage process."""
        stats = self.get_stats()
        glaciers = self.db.get_all_processed()
        
        if not stats:
            logger.error("No stats found to generate blog")
            return

        blog = self.generate_blog(stats, feedback)
        gallery = self.generate_gallery_items(glaciers)
        
        if blog:
            self.store_blog(blog)
        
        self.update_website_content(stats, blog, gallery)
        print(json.dumps({
            "blog_status": "success" if blog else "failed",
            "gallery_count": len(gallery)
        }, indent=2))

if __name__ == "__main__":
    generator = BlogGenerator()
    generator.run()
